// Kaarten, kleuren, waardes en slagvolgorde.
// Zie REGELS.md §2 voor de bron van waarheid.

export type Suit = "klaveren" | "harten" | "ruiten" | "schoppen";
export type Rank = "7" | "8" | "9" | "10" | "B" | "V" | "H" | "A";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export const SUITS: readonly Suit[] = ["klaveren", "harten", "ruiten", "schoppen"];
export const RANKS: readonly Rank[] = ["7", "8", "9", "10", "B", "V", "H", "A"];

/** Het contract van een ronde: een troefkleur of "sans" (zonder troef). */
export type Contract = { type: "kleur"; troef: Suit } | { type: "sans" };

// --- Puntwaardes (REGELS.md §2) ---

const TRUMP_POINTS: Record<Rank, number> = {
  B: 20,
  "9": 14,
  A: 11,
  "10": 10,
  H: 4,
  V: 3,
  "8": 0,
  "7": 0,
};

const PLAIN_POINTS: Record<Rank, number> = {
  A: 11,
  "10": 10,
  H: 4,
  V: 3,
  B: 2,
  "9": 0,
  "8": 0,
  "7": 0,
};

/** Is deze kaart troef gegeven het contract? Bij sans is niets troef. */
export function isTrump(card: Card, contract: Contract): boolean {
  return contract.type === "kleur" && card.suit === contract.troef;
}

/** Puntwaarde van een kaart gegeven het contract. */
export function cardPoints(card: Card, contract: Contract): number {
  return isTrump(card, contract) ? TRUMP_POINTS[card.rank] : PLAIN_POINTS[card.rank];
}

// --- Slagkracht (REGELS.md §2) ---
// Index 0 = sterkste. Gebruikt om binnen een slag te bepalen wie wint.

const TRUMP_ORDER: readonly Rank[] = ["B", "9", "A", "10", "H", "V", "8", "7"];
const PLAIN_ORDER: readonly Rank[] = ["A", "10", "H", "V", "B", "9", "8", "7"];

/** Sterkte van een troefkaart t.o.v. een andere troefkaart (hoger = sterker). */
function trumpStrength(rank: Rank): number {
  return TRUMP_ORDER.length - TRUMP_ORDER.indexOf(rank);
}

function plainStrength(rank: Rank): number {
  return PLAIN_ORDER.length - PLAIN_ORDER.indexOf(rank);
}

/** Is troefkaart a sterker dan troefkaart b? (beide moeten troef zijn) */
export function trumpStronger(a: Card, b: Card): boolean {
  return trumpStrength(a.rank) > trumpStrength(b.rank);
}

/**
 * Slagkracht van een kaart binnen een slag, gegeven contract en de gevraagde
 * kleur (ledSuit). Troef > gevraagde kleur > overige (kan niet winnen → 0).
 */
export function trickStrength(card: Card, contract: Contract, ledSuit: Suit): number {
  if (isTrump(card, contract)) return 200 + trumpStrength(card.rank);
  if (card.suit === ledSuit) return 100 + plainStrength(card.rank);
  return 0;
}

/** Een volledig, ongeschud spel van 32 kaarten. */
export function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function cardEquals(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit[0]}`; // bv. "Bk" = boer klaveren
}
