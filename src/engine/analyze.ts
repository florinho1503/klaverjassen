// Afgeleide spelkennis voor de bots. Gebruikt UITSLUITEND publieke informatie
// (gevallen kaarten) + de eigen hand — dus geen valsspelen.

import { Card, Contract, Suit, cardEquals, fullDeck, isTrump, trickStrength } from "./cards";
import { Round } from "./round";
import { Seat, Team, partnerOf, teamOf } from "./trick";

export interface RoundAnalysis {
  me: Seat;
  partner: Seat;
  team: Team;
  contract: Contract;
  myHand: Card[];
  /** Alle kaarten die al gespeeld zijn (afgeronde slagen + lopende slag). */
  played: Card[];
  /** Kaarten die nog in de andere drie handen zitten (vanuit mijn perspectief). */
  unseen: Card[];
  /** Bekende renonces: kleuren waarin een speler niet kon bekennen. */
  voids: Record<Seat, Set<Suit>>;
  /** Aantal troeven dat nog buiten mijn hand zit. */
  trumpsOut: number;
  /** Kleuren die mijn maat aanseinde (laag kaartje afgooien = "speel dit"). */
  partnerSignals: Suit[];
  /** Is deze kaart de hoogste van zijn kleur die nog in het spel is? */
  isHighestOfSuit: (c: Card) => boolean;
}

const LOW_SIGNAL_RANKS = new Set(["7", "8", "9"]);

export function analyzeRound(round: Round): RoundAnalysis {
  const me = round.currentSeat;
  const partner = partnerOf(me);
  const contract = round.contract;
  const myHand = [...round.handOf(me)];

  const played: Card[] = [];
  for (const t of round.tricks) for (const p of t.plays) played.push(p.card);
  for (const p of round.currentTrick) played.push(p.card);

  const unseen = fullDeck().filter(
    (c) => !myHand.some((h) => cardEquals(h, c)) && !played.some((p) => cardEquals(p, c)),
  );

  const voids: Record<Seat, Set<Suit>> = {
    0: new Set(),
    1: new Set(),
    2: new Set(),
    3: new Set(),
  };
  const partnerSignals: Suit[] = [];

  const scan = (plays: readonly { seat: Seat; card: Card }[]) => {
    if (plays.length === 0) return;
    const ledSuit = plays[0].card.suit;
    for (const p of plays) {
      if (p.card.suit !== ledSuit) {
        voids[p.seat].add(ledSuit);
        // Maat gooit een laag kaartje af in een andere kleur = aanseinen.
        if (p.seat === partner && LOW_SIGNAL_RANKS.has(p.card.rank)) {
          if (!partnerSignals.includes(p.card.suit)) partnerSignals.push(p.card.suit);
        }
      }
    }
  };
  for (const t of round.tricks) scan(t.plays);
  scan(round.currentTrick);

  const trumpsOut =
    contract.type === "kleur" ? unseen.filter((c) => isTrump(c, contract)).length : 0;

  const isHighestOfSuit = (c: Card): boolean =>
    !unseen.some(
      (u) =>
        u.suit === c.suit &&
        trickStrength(u, contract, c.suit) > trickStrength(c, contract, c.suit),
    );

  return {
    me,
    partner,
    team: teamOf(me),
    contract,
    myHand,
    played,
    unseen,
    voids,
    trumpsOut,
    partnerSignals,
    isHighestOfSuit,
  };
}
