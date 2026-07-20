// ─────────────────────────────────────────────────────────────────────────────
// Relay sweeper: reconcile the chain with the database.
//
// The voting route records votes in the database first and relays them
// on-chain fire-and-forget, so an RPC hiccup leaves a vote counted but
// without a tx_hash. This sweeper periodically finds those votes and:
//
//   1. Checks the chain for an existing transfer from the voter's wallet
//      to the ballot's position address. If one exists the relay actually
//      succeeded and only the backfill was lost — recover the hash from
//      the chain, spend no gas, and never double-count.
//   2. Only if the logs query SUCCEEDED and found nothing does it re-relay
//      the vote (grant top-up + transfer) and store the new hash. If the
//      logs query fails we skip — conservative by design: a missing hash
//      is cosmetic, a duplicate on-chain vote is a real discrepancy.
//
// Scope: public (non-org) support/oppose/multiple-choice votes only.
// Org and ranked-choice ballots are off-chain by design; demo-account
// votes are sandboxed and never relayed.
// ─────────────────────────────────────────────────────────────────────────────

import { ethers } from "ethers";
import { and, eq, isNull, inArray } from "drizzle-orm";
import { db } from "./db";
import { votes, proposals, users } from "@shared/schema";
import { storage } from "./storage-db";
import { baseNetwork } from "./base-network";
import { log } from "./app";

const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
const FIRST_SWEEP_DELAY_MS = 2 * 60 * 1000;   // 2 min after boot
const MAX_PER_SWEEP = 25;                      // bound gas spend per run
const INITIAL_BALLOT_GRANT = 1000;
const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
const DEMO_EMAIL = "demo@represent.app";

function positionAddress(proposalId: string, position: string): string {
  const hash = ethers.keccak256(ethers.toUtf8Bytes(`${proposalId}-${position}`));
  return ethers.getAddress("0x" + hash.slice(-40));
}

async function findExistingTransfer(
  provider: ethers.Provider,
  rpvToken: string,
  fromWallet: string,
  toAddress: string,
): Promise<string | null | undefined> {
  // Returns a tx hash if a matching transfer exists, null if the query
  // succeeded and found none, undefined if the query itself failed.
  try {
    const logs = await provider.getLogs({
      address: rpvToken,
      topics: [
        TRANSFER_TOPIC,
        ethers.zeroPadValue(fromWallet, 32),
        ethers.zeroPadValue(toAddress, 32),
      ],
      fromBlock: 0,
      toBlock: "latest",
    });
    return logs.length > 0 ? logs[0].transactionHash : null;
  } catch (e) {
    log(`Sweeper: logs query failed for ${fromWallet} → ${toAddress}: ${e}`);
    return undefined;
  }
}

export async function sweepMissingTxHashes(): Promise<void> {
  const rpvToken = process.env.RPV_TOKEN_ADDRESS;
  if (!rpvToken) return;

  let candidates;
  try {
    candidates = await db
      .select({
        userId: votes.userId,
        proposalId: votes.proposalId,
        position: votes.position,
        selectedOption: votes.selectedOption,
        organizationId: proposals.organizationId,
        options: proposals.options,
        optionAddresses: proposals.optionAddresses,
        email: users.email,
      })
      .from(votes)
      .innerJoin(proposals, eq(votes.proposalId, proposals.id))
      .innerJoin(users, eq(votes.userId, users.id))
      .where(and(
        isNull(votes.txHash),
        isNull(proposals.organizationId),
        inArray(votes.position, ["support", "oppose", "multiple-choice"]),
      ))
      .limit(MAX_PER_SWEEP);
  } catch (e) {
    log(`Sweeper: candidate query failed: ${e}`);
    return;
  }

  if (!candidates.length) return;
  log(`Sweeper: ${candidates.length} vote(s) missing tx_hash — reconciling`);

  const provider = new ethers.JsonRpcProvider(
    process.env.BASE_RPC_URL ||
      (process.env.BASE_NETWORK === "mainnet" ? "https://mainnet.base.org" : "https://sepolia.base.org"),
  );

  let recovered = 0;
  let relayed = 0;
  let skipped = 0;

  for (const v of candidates) {
    try {
      if (v.email === DEMO_EMAIL) { skipped++; continue; }

      const wallet = await storage.getUserWallet(v.userId);
      if (!wallet) { skipped++; continue; }

      // Resolve the destination address exactly as the vote route does.
      let voteAddress: string | undefined;
      if (v.position === "multiple-choice") {
        const opts = Array.isArray(v.options) ? v.options : [];
        const addrs = Array.isArray(v.optionAddresses) ? v.optionAddresses : [];
        const idx = v.selectedOption ? opts.indexOf(v.selectedOption) : -1;
        if (idx >= 0 && idx < addrs.length) voteAddress = addrs[idx];
      } else {
        voteAddress = positionAddress(v.proposalId, v.position);
      }
      if (!voteAddress) { skipped++; continue; }

      // 1. Recover a hash the relay already earned, if any.
      const existing = await findExistingTransfer(provider, rpvToken, wallet.address, voteAddress);
      if (existing === undefined) { skipped++; continue; } // query failed — do NOT resend
      if (existing) {
        await storage.updateVoteTxHash(v.userId, v.proposalId, existing);
        recovered++;
        log(`Sweeper: recovered hash from chain for proposal=${v.proposalId}: ${existing}`);
        continue;
      }

      // 2. Genuinely missing on-chain — re-relay.
      const balance = await baseNetwork.getRPVBalance(rpvToken, wallet.address);
      if (parseFloat(balance) < 1) {
        const grant = await baseNetwork.transferRPVToken(rpvToken, wallet.address, INITIAL_BALLOT_GRANT);
        if (!grant.success) {
          log(`Sweeper: grant top-up failed for proposal=${v.proposalId}: ${grant.error}`);
          skipped++;
          continue;
        }
      }
      const result = await baseNetwork.voteWithRelayPattern(
        rpvToken,
        wallet.privateKey,
        wallet.address,
        v.position as "support" | "oppose" | "multiple-choice",
        v.proposalId,
        v.position === "multiple-choice" ? voteAddress : undefined,
      );
      if (result.success && result.txHash) {
        await storage.updateVoteTxHash(v.userId, v.proposalId, result.txHash);
        relayed++;
        log(`Sweeper: re-relayed vote for proposal=${v.proposalId}: ${result.txHash}`);
      } else {
        skipped++;
        log(`Sweeper: re-relay failed for proposal=${v.proposalId}: ${result.error}`);
      }
    } catch (e) {
      skipped++;
      log(`Sweeper: error on proposal=${v.proposalId}: ${e}`);
    }
  }

  log(`Sweeper done: ${recovered} recovered from chain, ${relayed} re-relayed, ${skipped} skipped`);
}

export function startRelaySweeper(): void {
  if (!process.env.RPV_TOKEN_ADDRESS) {
    log("Sweeper: RPV_TOKEN_ADDRESS not set — sweeper disabled");
    return;
  }
  setTimeout(() => { void sweepMissingTxHashes(); }, FIRST_SWEEP_DELAY_MS);
  setInterval(() => { void sweepMissingTxHashes(); }, SWEEP_INTERVAL_MS);
  log(`Sweeper: armed — first run in ${FIRST_SWEEP_DELAY_MS / 1000}s, then every ${SWEEP_INTERVAL_MS / 3600000}h`);
}
