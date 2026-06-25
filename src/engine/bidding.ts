// Biedronde. Zie REGELS.md §4.
//
// Een bod = een getal + een contract (kleur of sans). Het getal is je doel/nat-grens.
// Het hoogste bod wint; die speler wordt maker. Wie past doet niet meer mee.
// Minimum: 80 voor een kleur, 70 voor sans; verhogingen in stappen van 10.

import { Card, Contract, SUITS } from "./cards";
import { Round } from "./round";
import { Seat, Team, nextSeat, teamOf } from "./trick";

export interface Bid {
  value: number;
  contract: Contract;
}

export type BidAction = Bid | "pas";

export interface AuctionConfig {
  /** Wie opent het bieden (links van de deler). */
  firstBidder: Seat;
  minKleur?: number; // standaard 80
  minSans?: number; // standaard 70
  step?: number; // standaard 10
}

export interface AuctionResult {
  makerSeat: Seat;
  makerTeam: Team;
  bid: Bid;
}

export interface AuctionLogEntry {
  seat: Seat;
  action: BidAction;
}

export class Auction {
  private turn: Seat;
  private consecutivePasses = 0;
  private highest: { seat: Seat; bid: Bid } | null = null;
  private readonly minKleur: number;
  private readonly minSans: number;
  private readonly step: number;
  readonly log: AuctionLogEntry[] = [];

  constructor(config: AuctionConfig) {
    this.turn = config.firstBidder;
    this.minKleur = config.minKleur ?? 80;
    this.minSans = config.minSans ?? 70;
    this.step = config.step ?? 10;
  }

  get currentSeat(): Seat {
    return this.turn;
  }

  get currentHighest(): { seat: Seat; bid: Bid } | null {
    return this.highest;
  }

  get isComplete(): boolean {
    // Passen haalt je er niet uit; je mag er later weer overheen. Het bieden
    // stopt pas als iedereen achter elkaar past.
    if (this.highest === null) return this.consecutivePasses >= 4; // niemand bood
    return this.consecutivePasses >= 3; // de 3 anderen pasten na het laatste bod
  }

  /** Laagste toegestane bod voor een contract op dit moment. */
  minimumFor(contract: Contract): number {
    const base = contract.type === "sans" ? this.minSans : this.minKleur;
    if (!this.highest) return base;
    return Math.max(base, this.highest.bid.value + this.step);
  }

  isLegal(action: BidAction): boolean {
    if (this.isComplete) return false;
    if (action === "pas") return true;
    if (action.value % this.step !== 0) return false;
    return action.value >= this.minimumFor(action.contract);
  }

  bid(action: BidAction): void {
    if (this.isComplete) throw new Error("Het bieden is afgelopen");
    const seat = this.turn;
    if (action === "pas") {
      this.consecutivePasses += 1;
    } else {
      if (!this.isLegal(action)) throw new Error("Ongeldig bod");
      this.highest = { seat, bid: action };
      this.consecutivePasses = 0; // een nieuw bod opent het bieden weer
    }
    this.log.push({ seat, action });
    if (!this.isComplete) this.turn = nextSeat(this.turn);
  }

  /** Uitkomst van het bieden, of null als iedereen paste. */
  result(): AuctionResult | null {
    if (!this.isComplete) throw new Error("Het bieden is nog niet afgelopen");
    if (!this.highest) return null;
    return {
      makerSeat: this.highest.seat,
      makerTeam: teamOf(this.highest.seat),
      bid: this.highest.bid,
    };
  }
}

// --- Handwaardering voor de bot (REGELS.md §4) ---

/** Winnaars in de hand: azen + "gedekte" tienen (10 met minstens één kaart erbij). */
function countWinners(hand: Card[]): number {
  const aces = hand.filter((c) => c.rank === "A").length;
  let gedekteTens = 0;
  for (const suit of SUITS) {
    const inSuit = hand.filter((c) => c.suit === suit);
    if (inSuit.length >= 2 && inSuit.some((c) => c.rank === "10")) gedekteTens++;
  }
  return aces + gedekteTens;
}

/**
 * Het sterkste bod dat de bot met deze hand zou willen doen, of null (passen).
 * Dit is de bovengrens van wat de hand rechtvaardigt — in het bieden zelf biedt
 * de bot minimaal (zie `biddingBot`).
 */
export function evaluateBid(hand: Card[]): Bid | null {
  let best: Bid | null = null;

  // Kleurbod: anker op boer/negen van een kleur.
  const extras = countWinners(hand);
  for (const suit of SUITS) {
    const hasB = hand.some((c) => c.suit === suit && c.rank === "B");
    const has9 = hand.some((c) => c.suit === suit && c.rank === "9");
    let value = 0;
    if (hasB && has9) value = Math.min(90 + extras * 10, 110);
    else if (hasB || has9) value = 80;
    else continue;
    if (!best || value > best.value) best = { value, contract: { type: "kleur", troef: suit } };
  }

  // Sansbod: gedreven door azen (zekere slagen) en GEDEKTE tienen. Bewust
  // conservatief, want sans is veel zwaarder: 90 sans = 90/130 (69%) tegen
  // 90 in een kleur = 90/162 (56%). Een kale tien telt niet mee (loopt onder de aas).
  const aces = hand.filter((c) => c.rank === "A").length;
  let gedekteTens = 0;
  for (const suit of SUITS) {
    const inSuit = hand.filter((c) => c.suit === suit);
    if (inSuit.length >= 2 && inSuit.some((c) => c.rank === "10")) gedekteTens++;
  }
  const sansScore = aces * 2 + gedekteTens;
  let sansValue = 0;
  if (sansScore >= 10) sansValue = 100;
  else if (sansScore >= 8) sansValue = 90;
  else if (sansScore >= 6) sansValue = 80;
  else if (sansScore >= 5) sansValue = 70;
  if (sansValue > 0 && (!best || sansValue > best.value)) {
    best = { value: sansValue, contract: { type: "sans" } };
  }

  return best;
}

/** Biedbeslissing: bied minimaal nodig in je beste contract, mits je hand het toelaat. */
export function biddingBot(auction: Auction, hand: Card[]): BidAction {
  const want = evaluateBid(hand);
  if (!want) return "pas";
  const min = auction.minimumFor(want.contract);
  if (min > want.value) return "pas"; // verder bieden dan de hand rechtvaardigt → passen
  return { value: min, contract: want.contract };
}

/** Speelt een hele biedronde af met een beslis-functie (standaard de bot). */
export function runAuction(
  config: AuctionConfig,
  hands: Card[][],
  decide: (auction: Auction, hand: Card[]) => BidAction = biddingBot,
): AuctionResult | null {
  const auction = new Auction(config);
  while (!auction.isComplete) {
    auction.bid(decide(auction, hands[auction.currentSeat]));
  }
  return auction.result();
}

/** Bouwt een speelbare ronde uit de uitkomst van het bieden. */
export function roundFromAuction(
  result: AuctionResult,
  hands: Card[][],
  firstLeader: Seat,
  bids?: AuctionLogEntry[],
): Round {
  return new Round({
    contract: result.bid.contract,
    makerTeam: result.makerTeam,
    bid: result.bid.value,
    hands,
    firstLeader,
    bids,
  });
}
