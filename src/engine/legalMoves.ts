// Geldige zetten — Amsterdamse variant. Zie REGELS.md §6.
//
// Regels:
//  1. Bekennen verplicht als je de gevraagde kleur hebt.
//  2. Kun je niet bekennen + je MAAT wint de slag → vrij (maatslag-uitzondering).
//  3. Kun je niet bekennen + de TEGENSTANDER wint → introeven verplicht (als je troef hebt).
//  4. Overtroefplicht: speel je troef, dan hoger dan de hoogste troef in de slag, indien mogelijk.
//  5. Kun je niet overtroeven: ondertroeven verplicht (aanname, zie open punt in REGELS.md).

import { Card, Contract, cardEquals, isTrump, trumpStronger } from "./cards";
import { Play, Seat, partnerOf, trickWinnerSeat } from "./trick";

/** Huisregel-aanname: bij niet kunnen overtroeven tóch een lagere troef bijleggen. */
export const MUST_UNDERTRUMP = true;

/**
 * Alle kaarten uit `hand` die je legaal mag spelen, gegeven de lopende slag.
 * `trick` = reeds gespeelde kaarten deze slag (kan leeg zijn als jij uitkomt).
 */
export function legalMoves(
  hand: Card[],
  trick: Play[],
  contract: Contract,
  seat: Seat,
): Card[] {
  // Uitkomen: alles mag.
  if (trick.length === 0) return [...hand];

  const ledSuit = trick[0].card.suit;
  const sameSuit = hand.filter((c) => c.suit === ledSuit);

  // Sans: geen troef. Bekennen indien mogelijk, anders vrij.
  if (contract.type === "sans") {
    return sameSuit.length ? sameSuit : [...hand];
  }

  const trumps = hand.filter((c) => isTrump(c, contract));
  const trumpsInTrick = trick.map((p) => p.card).filter((c) => isTrump(c, contract));
  const highestTrumpInTrick =
    trumpsInTrick.length > 0
      ? trumpsInTrick.reduce((a, b) => (trumpStronger(b, a) ? b : a))
      : null;

  // Onder de troeven alleen de kaarten die hoger zijn dan de hoogste troef in de slag.
  // (Als er nog geen troef ligt, kwalificeert elke troef.)
  const higherTrumps = highestTrumpInTrick
    ? trumps.filter((c) => trumpStronger(c, highestTrumpInTrick))
    : trumps;

  const ledIsTrump = ledSuit === contract.troef;
  const partnerWinning = trickWinnerSeat(trick, contract) === partnerOf(seat);

  // Troef gevraagd: troef bekennen verplicht.
  if (ledIsTrump) {
    if (trumps.length === 0) return [...hand];
    // Je hoeft je maat niet te overtroeven (maatslag); tegen de tegenstander wel.
    if (partnerWinning) return trumps;
    return higherTrumps.length ? higherTrumps : trumps;
  }

  // Niet-troef gevraagd, en je kunt bekennen → verplicht.
  if (sameSuit.length) return sameSuit;

  // Je kunt niet bekennen.
  if (partnerWinning) {
    // Maatslag: niet verplicht te troeven → vrij.
    return [...hand];
  }

  // Tegenstander wint → introeven verplicht (als je troef hebt).
  if (trumps.length === 0) return [...hand];
  if (higherTrumps.length) return higherTrumps; // overtroeven verplicht
  return MUST_UNDERTRUMP ? trumps : [...hand]; // anders ondertroeven (aanname)
}

/** Is deze kaart een geldige zet? */
export function isLegalMove(
  card: Card,
  hand: Card[],
  trick: Play[],
  contract: Contract,
  seat: Seat,
): boolean {
  return legalMoves(hand, trick, contract, seat).some(
    (c) => c.suit === card.suit && c.rank === card.rank,
  );
}

/**
 * Legt uit waarom een zet niet mag (voor de foutmelding in de UI), of null als
 * de zet wél geldig is. De tekst noemt de overtreden regel.
 */
export function explainIllegal(
  card: Card,
  hand: Card[],
  trick: Play[],
  contract: Contract,
  seat: Seat,
): string | null {
  if (trick.length === 0) return null;
  if (legalMoves(hand, trick, contract, seat).some((c) => cardEquals(c, card))) return null;
  if (!hand.some((c) => cardEquals(c, card))) return "Die kaart heb je niet.";

  const ledSuit = trick[0].card.suit;
  const sameSuit = hand.filter((c) => c.suit === ledSuit);

  if (contract.type === "sans") {
    if (sameSuit.length) return `Je moet bekennen (${ledSuit}).`;
    return "Ongeldige zet.";
  }

  const playedTrump = isTrump(card, contract);
  const trumps = hand.filter((c) => isTrump(c, contract));

  if (ledSuit === contract.troef) {
    if (!playedTrump && trumps.length) return `Je moet troef bijspelen (${ledSuit}).`;
    return "Je moet overtroeven — hoger dan de hoogste troef in de slag.";
  }

  if (sameSuit.length) return `Je moet bekennen (${ledSuit}).`;

  const partnerWinning = trickWinnerSeat(trick, contract) === partnerOf(seat);
  if (!partnerWinning) {
    if (!playedTrump && trumps.length) return "Je moet introeven — de tegenstander wint de slag.";
    return "Je moet overtroeven — hoger dan de hoogste troef in de slag.";
  }
  return "Ongeldige zet.";
}
