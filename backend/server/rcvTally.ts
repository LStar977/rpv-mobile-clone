// Pure instant-runoff voting (IRV) tally. No DB access — takes ballots as
// arrays of option labels and returns a structured walkthrough of the
// elimination rounds plus the winner.
//
// Algorithm:
//   1. Strip eliminated options from each ballot's preference list.
//   2. Count first-choice votes per remaining option.
//   3. If any option has > 50% of non-exhausted ballots, declare winner.
//   4. Otherwise eliminate the option with fewest first-choice votes
//      (alphabetical-last on tie — deterministic, documented).
//   5. Repeat from step 1.
//   6. If only two options remain and tie, declare alphabetical-first winner.
//
// Documented tie-break rules let auditors reproduce the result deterministic-
// ally from the same set of ballots.

export interface RCVRound {
  round: number;
  // option label → first-choice votes among non-exhausted ballots this round
  counts: Record<string, number>;
  // options eliminated AT THE END of this round (drives the next round)
  eliminated: string[];
  // ballots that became exhausted DURING this round (their remaining
  // preferences were all already-eliminated options)
  exhaustedThisRound: number;
  // total ballots considered in this round (excludes ballots exhausted in
  // earlier rounds)
  activeBallots: number;
}

export interface RCVTally {
  options: string[];                          // proposal.options as given
  totalBallots: number;                       // including ballots exhausted later
  exhaustedBallots: number;                   // total exhausted across all rounds
  rounds: RCVRound[];
  winner: string | null;                      // null only if zero ballots
  winningRound: number | null;                // 1-indexed round in which winner crossed 50%
  tieBreakRule: 'alphabetical-last';
}

/**
 * Compute IRV tally. `ballots[i]` is the i-th voter's ranked preferences;
 * each entry is an option label (must be in `options`). Duplicates within a
 * single ballot are caller's responsibility — backend validation rejects
 * those before calling this. Empty ballots are treated as exhausted from
 * round 1 (counted in totalBallots / exhaustedBallots but contribute no
 * votes).
 */
export function computeIRV(ballots: string[][], options: string[]): RCVTally {
  const totalBallots = ballots.length;

  if (totalBallots === 0) {
    return {
      options: [...options],
      totalBallots: 0,
      exhaustedBallots: 0,
      rounds: [],
      winner: null,
      winningRound: null,
      tieBreakRule: 'alphabetical-last',
    };
  }

  // Track which options are still in contention. Mutated each round.
  const eliminated = new Set<string>();
  const optionSet = new Set(options);
  // Per-ballot pointer into the preference list. Once a ballot is
  // exhausted, mark its index in `exhaustedSet` so we skip it cleanly.
  const exhaustedSet = new Set<number>();

  const rounds: RCVRound[] = [];
  let winner: string | null = null;
  let winningRound: number | null = null;

  // Cap iterations at options.length to guarantee termination — IRV always
  // converges within N-1 rounds for N options (one elimination per round).
  for (let r = 1; r <= options.length; r++) {
    // Step 1+2: tally first-choice votes among non-eliminated options.
    const counts: Record<string, number> = {};
    for (const opt of options) {
      if (!eliminated.has(opt)) counts[opt] = 0;
    }

    let exhaustedThisRound = 0;
    let activeBallots = 0;

    ballots.forEach((ballot, i) => {
      if (exhaustedSet.has(i)) return;
      // Walk the ballot to find the first non-eliminated valid preference.
      let found: string | null = null;
      for (const pref of ballot) {
        if (!optionSet.has(pref)) continue;        // unknown option — skip
        if (eliminated.has(pref)) continue;        // already out — skip
        found = pref;
        break;
      }
      if (found === null) {
        exhaustedSet.add(i);
        exhaustedThisRound++;
        return;
      }
      counts[found] = (counts[found] ?? 0) + 1;
      activeBallots++;
    });

    // Step 3: majority check. > 50% wins.
    if (activeBallots > 0) {
      for (const [opt, count] of Object.entries(counts)) {
        if (count * 2 > activeBallots) {
          winner = opt;
          winningRound = r;
          rounds.push({ round: r, counts, eliminated: [], exhaustedThisRound, activeBallots });
          break;
        }
      }
    }
    if (winner) break;

    // No majority. Decide what to eliminate.
    const remaining = Object.keys(counts);
    if (remaining.length <= 1) {
      // Edge case: only one option left after exhaustion. Declare it the
      // winner (it has 100% of remaining active ballots, even if active is 0).
      winner = remaining[0] ?? null;
      winningRound = winner ? r : null;
      rounds.push({ round: r, counts, eliminated: [], exhaustedThisRound, activeBallots });
      break;
    }

    // Final-pair tie special case: two options left with equal counts ⇒
    // alphabetical-first wins (so we don't eliminate everyone).
    if (remaining.length === 2) {
      const [a, b] = remaining;
      if (counts[a] === counts[b]) {
        const winnerOfTie = a < b ? a : b;
        winner = winnerOfTie;
        winningRound = r;
        rounds.push({ round: r, counts, eliminated: [], exhaustedThisRound, activeBallots });
        break;
      }
    }

    // Step 4: eliminate the option with fewest first-choice votes.
    // Tie-break: alphabetical-last.
    let minCount = Infinity;
    for (const opt of remaining) {
      if (counts[opt] < minCount) minCount = counts[opt];
    }
    const tied = remaining.filter((opt) => counts[opt] === minCount);
    // Alphabetical-last among ties.
    tied.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    const toEliminate = tied[0];
    eliminated.add(toEliminate);

    rounds.push({
      round: r,
      counts,
      eliminated: [toEliminate],
      exhaustedThisRound,
      activeBallots,
    });
  }

  return {
    options: [...options],
    totalBallots,
    exhaustedBallots: exhaustedSet.size,
    rounds,
    winner,
    winningRound,
    tieBreakRule: 'alphabetical-last',
  };
}
