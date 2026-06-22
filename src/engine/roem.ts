// Roem ("klopjes") binnen één slag. Zie REGELS.md §7.
//
//  stuk (H+V van troef)              = 20
//  3 op een rij (zelfde kleur)       = 20
//  4 op een rij                      = 50
//  4 op een rij met stuk             = 70  (= 50 + 20, ontstaat vanzelf)
//
// Roem = looppunten + (stuk ? 20 : 0). Een 3-loop in troef met H+V telt dus 40.

import { Card, Contract, Suit } from "./cards";

// Natuurlijke rangvolgorde voor "op een rij" (NIET de slagvolgorde).
const SEQUENCE: readonly Card["rank"][] = ["7", "8", "9", "10", "B", "V", "H", "A"];

function seqIndex(rank: Card["rank"]): number {
  return SEQUENCE.indexOf(rank);
}

/** Langste aaneengesloten reeks binnen één kleur in deze kaarten. */
function longestRunInSuit(cards: Card[], suit: Suit): number {
  const indices = cards
    .filter((c) => c.suit === suit)
    .map((c) => seqIndex(c.rank))
    .sort((a, b) => a - b);
  if (indices.length === 0) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] === indices[i - 1] + 1) {
      cur++;
      best = Math.max(best, cur);
    } else if (indices[i] !== indices[i - 1]) {
      cur = 1;
    }
  }
  return best;
}

function runPoints(run: number): number {
  if (run >= 4) return 50;
  if (run === 3) return 20;
  return 0;
}

/** Bevat de slag het stuk (H en V van troef)? */
function hasStuk(cards: Card[], contract: Contract): boolean {
  if (contract.type !== "kleur") return false;
  const troef = contract.troef;
  const heer = cards.some((c) => c.suit === troef && c.rank === "H");
  const vrouw = cards.some((c) => c.suit === troef && c.rank === "V");
  return heer && vrouw;
}

/** Roem-punten in een (deel)slag. */
export function roemInTrick(cards: Card[], contract: Contract): number {
  const suits = new Set(cards.map((c) => c.suit));
  let bestRun = 0;
  for (const suit of suits) {
    bestRun = Math.max(bestRun, longestRunInSuit(cards, suit));
  }
  const stuk = hasStuk(cards, contract) ? 20 : 0;
  return runPoints(bestRun) + stuk;
}
