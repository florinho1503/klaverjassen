// Schudden en delen.

import { Card, fullDeck } from "./cards";

export type Rng = () => number;

/** Fisher-Yates shuffle. RNG injecteerbaar voor deterministische tests. */
export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Deelt 32 kaarten over 4 zitplaatsen (8 elk). Geeft een array van 4 handen,
 * geïndexeerd op zitplaats (0=N, 1=O, 2=Z, 3=W).
 */
export function deal(rng: Rng = Math.random): Card[][] {
  const deck = shuffle(fullDeck(), rng);
  const hands: Card[][] = [[], [], [], []];
  deck.forEach((c, i) => hands[i % 4].push(c));
  return hands;
}
