// Scoring van een ronde. Zie REGELS.md §3, §5, §8.
//
// - Kaartpunten + roem + 10 voor de laatste slag.
// - Maker moet minimaal zijn geboden aantal halen, anders nat (alles naar tegenpartij).
// - Pit: één team wint alle 8 slagen → +100.
// - "Op papier": punten / 10, met drempel bij 7 (0–6 omlaag, 7–9 omhoog).

import { Contract } from "./cards";
import { Team } from "./trick";

export interface TrickResult {
  winnerTeam: Team;
  /** Kaartpunten in deze slag (zonder de +10 voor de laatste slag). */
  cardPoints: number;
  /** Roempunten in deze slag. */
  roem: number;
  isLast?: boolean;
}

export interface RoundInput {
  contract: Contract;
  /** Het geboden aantal punten dat de maker moet halen. */
  bid: number;
  /** Team dat het bod won en speelt. */
  makerTeam: Team;
  /** Precies 8 slagen. */
  tricks: TrickResult[];
}

export interface RoundResult {
  makerTeam: Team;
  defenderTeam: Team;
  /** Ruwe punten per team (kaart + roem + laatste slag + pit). */
  points: [number, number];
  /** Punten "op papier" (afgerond / 10). */
  paper: [number, number];
  nat: boolean;
  /** Team dat pit liep (alle 8 slagen), of null. */
  pitTeam: Team | null;
  makerPoints: number;
}

const LAST_TRICK_BONUS = 10;
const PIT_BONUS = 100;

/** Afronding "op papier": 0–6 omlaag, 7–9 omhoog. Zie REGELS.md §3. */
export function toPaper(points: number): number {
  const lastDigit = points % 10;
  const base = points - lastDigit;
  return lastDigit >= 7 ? base / 10 + 1 : base / 10;
}

export function scoreRound(input: RoundInput): RoundResult {
  const { bid, makerTeam, tricks } = input;
  const defenderTeam: Team = makerTeam === 0 ? 1 : 0;

  const cardByTeam: [number, number] = [0, 0];
  const roemByTeam: [number, number] = [0, 0];
  const tricksWon: [number, number] = [0, 0];

  for (const t of tricks) {
    cardByTeam[t.winnerTeam] += t.cardPoints;
    roemByTeam[t.winnerTeam] += t.roem;
    tricksWon[t.winnerTeam] += 1;
    if (t.isLast) cardByTeam[t.winnerTeam] += LAST_TRICK_BONUS;
  }

  const totalByTeam: [number, number] = [
    cardByTeam[0] + roemByTeam[0],
    cardByTeam[1] + roemByTeam[1],
  ];
  const fullTotal = totalByTeam[0] + totalByTeam[1];

  const makerPoints = totalByTeam[makerTeam];
  const nat = makerPoints < bid;

  const points: [number, number] = [0, 0];
  if (nat) {
    // Alles (kaartpunten + alle roem) naar de tegenpartij.
    points[defenderTeam] = fullTotal;
    points[makerTeam] = 0;
  } else {
    points[0] = totalByTeam[0];
    points[1] = totalByTeam[1];
  }

  // Pit: één team won alle 8 slagen.
  let pitTeam: Team | null = null;
  if (tricksWon[0] === 8) pitTeam = 0;
  else if (tricksWon[1] === 8) pitTeam = 1;
  if (pitTeam !== null) points[pitTeam] += PIT_BONUS;

  return {
    makerTeam,
    defenderTeam,
    points,
    paper: [toPaper(points[0]), toPaper(points[1])],
    nat,
    pitTeam,
    makerPoints,
  };
}
