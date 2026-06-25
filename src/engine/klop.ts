// Scoring met "klop": roem van het kloppende team telt alleen mee als die slag
// geklopt is. Een foute klop (geklopt op een slag zonder roem) levert in de
// strenge modus een straf op voor de tegenstander.

import { Contract } from "./cards";
import { RoundResult, TrickResult, scoreRound, toPaper } from "./scoring";
import { Team } from "./trick";

export const FOUTE_KLOP_PENALTY = 20;

export interface KlopScoreInput {
  contract: Contract;
  bid: number;
  makerTeam: Team;
  /** Originele slagen (met roem en winnerTeam). */
  tricks: TrickResult[];
  /** Team dat moet kloppen om z'n roem te laten tellen (de mens). */
  klopTeam: Team;
  /** Indexen van slagen die geklopt zijn. */
  klopped: ReadonlySet<number>;
  /** Strenge modus (middel/moeilijk): foute klop straft. */
  strict: boolean;
}

export function scoreWithKlop(input: KlopScoreInput): RoundResult {
  const { contract, bid, makerTeam, tricks, klopTeam, klopped, strict } = input;

  // Roem van het klopteam telt alleen bij een geklopte slag; die van de
  // tegenstander telt altijd.
  const gated: TrickResult[] = tricks.map((t, i) => ({
    ...t,
    roem: t.winnerTeam === klopTeam && !klopped.has(i) ? 0 : t.roem,
  }));

  const result = scoreRound({ contract, bid, makerTeam, tricks: gated });

  if (strict) {
    let penalty = 0;
    klopped.forEach((i) => {
      if (tricks[i] && tricks[i].roem === 0) penalty += FOUTE_KLOP_PENALTY;
    });
    if (penalty > 0) {
      const opp: Team = klopTeam === 0 ? 1 : 0;
      result.points[opp] += penalty;
      result.paper = [toPaper(result.points[0]), toPaper(result.points[1])];
    }
  }

  return result;
}
