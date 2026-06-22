// Hulpjes om in tests compact kaarten te maken: card("Bk") = boer klaveren.

import { Card, Rank, Suit } from "./cards";

const SUIT_BY_LETTER: Record<string, Suit> = {
  k: "klaveren",
  h: "harten",
  r: "ruiten",
  s: "schoppen",
};

/** card("10h") = harten 10, card("Bk") = boer klaveren. */
export function card(code: string): Card {
  const suitLetter = code.slice(-1);
  const rank = code.slice(0, -1) as Rank;
  const suit = SUIT_BY_LETTER[suitLetter];
  if (!suit) throw new Error(`Onbekende kleur in "${code}"`);
  return { suit, rank };
}

export function cards(...codes: string[]): Card[] {
  return codes.map(card);
}

/** Deterministische PRNG (mulberry32) voor reproduceerbare tests. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
