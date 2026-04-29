import 'dotenv/config';
import { db } from './db';
import { wallets } from '@shared/schema';
import { eq, and, ne, or, isNull } from 'drizzle-orm';
import { encryptPrivateKey, isEncrypted } from './crypto';

async function migrateEncryptWallets() {
  console.log('[migration] Starting wallet private key encryption migration...');

  // Filter at the DB level: only rows not yet marked encrypted with a non-empty key
  const unencryptedWallets = await db
    .select()
    .from(wallets)
    .where(
      and(
        or(eq(wallets.encrypted, false), isNull(wallets.encrypted)),
        ne(wallets.privateKey, '')
      )
    );

  console.log(`[migration] Found ${unencryptedWallets.length} unencrypted wallets to process`);

  let skipped = 0;
  let encrypted = 0;
  let errored = 0;

  for (const wallet of unencryptedWallets) {
    if (isEncrypted(wallet.privateKey)) {
      // Already encrypted despite flag being false — just update the flag
      await db.update(wallets)
        .set({ encrypted: true })
        .where(eq(wallets.id, wallet.id));
      skipped++;
      continue;
    }

    try {
      const encryptedKey = encryptPrivateKey(wallet.privateKey);
      await db.update(wallets)
        .set({ privateKey: encryptedKey, encrypted: true })
        .where(eq(wallets.id, wallet.id));
      console.log(`[migration] ✓ Encrypted wallet ${wallet.id} (userId=${wallet.userId})`);
      encrypted++;
    } catch (e) {
      console.error(`[migration] ✗ Failed to encrypt wallet ${wallet.id}:`, e);
      errored++;
    }
  }

  console.log(`[migration] Done. Encrypted: ${encrypted}, Skipped (already done): ${skipped}, Errors: ${errored}`);
  process.exit(errored > 0 ? 1 : 0);
}

migrateEncryptWallets().catch((e) => {
  console.error('[migration] Fatal error:', e);
  process.exit(1);
});
