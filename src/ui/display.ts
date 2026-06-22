// Weergave-helpers voor de UI.

import { Contract, Seat, Suit } from "../engine";

export const SUIT_SYMBOL: Record<Suit, string> = {
  klaveren: "♣",
  harten: "♥",
  ruiten: "♦",
  schoppen: "♠",
};

export const SUIT_NAME: Record<Suit, string> = {
  klaveren: "Klaveren",
  harten: "Harten",
  ruiten: "Ruiten",
  schoppen: "Schoppen",
};

/** Harten en ruiten zijn rood. */
export function isRed(suit: Suit): boolean {
  return suit === "harten" || suit === "ruiten";
}

export const SEAT_NAME: Record<Seat, string> = {
  0: "Noord",
  1: "Oost",
  2: "Zuid (jij)",
  3: "West",
};

export function contractLabel(contract: Contract): string {
  return contract.type === "sans" ? "Sans (zonder troef)" : SUIT_NAME[contract.troef];
}

export function contractShort(contract: Contract): string {
  return contract.type === "sans" ? "SANS" : SUIT_SYMBOL[contract.troef];
}
