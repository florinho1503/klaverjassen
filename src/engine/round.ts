// Rondeloop: speelt één ronde (8 slagen) af. Zie REGELS.md.

import { Card, Contract, cardEquals, cardPoints } from "./cards";
import { isLegalMove, legalMoves } from "./legalMoves";
import { roemInTrick } from "./roem";
import { RoundResult, TrickResult, scoreRound } from "./scoring";
import {
  Play,
  Seat,
  Team,
  nextSeat,
  teamOf,
  trickWinnerSeat,
} from "./trick";

/** Een afgeronde slag met uitkomst. */
export interface CompletedTrick {
  plays: Play[];
  winnerSeat: Seat;
  winnerTeam: Team;
  /** Kaartpunten in deze slag (zonder de +10 voor de laatste slag). */
  cardPoints: number;
  roem: number;
  isLast: boolean;
}

export interface RoundConfig {
  contract: Contract;
  makerTeam: Team;
  /** Het geboden aantal dat de maker moet halen. */
  bid: number;
  /** 4 handen, geïndexeerd op zitplaats (0..3), elk 8 kaarten. */
  hands: Card[][];
  /** Wie komt uit voor de eerste slag? Standaard zitplaats 0. */
  firstLeader?: Seat;
}

/**
 * State machine voor één ronde. Muteerbaar: `play()` voert een zet uit.
 * Geschikt voor zowel bots (via `playRound`) als een interactieve UI.
 */
export class Round {
  readonly contract: Contract;
  readonly makerTeam: Team;
  readonly bid: number;

  private readonly hands: Card[][];
  private trick: Play[] = [];
  private turn: Seat;
  private readonly completed: CompletedTrick[] = [];

  constructor(config: RoundConfig) {
    if (config.hands.length !== 4 || config.hands.some((h) => h.length !== 8)) {
      throw new Error("Een ronde vereist 4 handen van 8 kaarten");
    }
    this.contract = config.contract;
    this.makerTeam = config.makerTeam;
    this.bid = config.bid;
    this.hands = config.hands.map((h) => [...h]);
    this.turn = config.firstLeader ?? 0;
  }

  /** Zitplaats die nu aan zet is. */
  get currentSeat(): Seat {
    return this.turn;
  }

  /** Kaarten die op tafel liggen in de lopende slag. */
  get currentTrick(): readonly Play[] {
    return this.trick;
  }

  /** Afgeronde slagen tot nu toe. */
  get tricks(): readonly CompletedTrick[] {
    return this.completed;
  }

  get isComplete(): boolean {
    return this.completed.length === 8;
  }

  /** Resterende hand van een zitplaats (read-only kopie). */
  handOf(seat: Seat): readonly Card[] {
    return this.hands[seat];
  }

  /** Geldige zetten voor de speler die nu aan zet is. */
  legalMoves(): Card[] {
    return legalMoves(this.hands[this.turn], this.trick, this.contract, this.turn);
  }

  /** Voer een zet uit voor de speler die nu aan zet is. */
  play(card: Card): void {
    if (this.isComplete) throw new Error("De ronde is al afgelopen");
    const seat = this.turn;
    if (!isLegalMove(card, this.hands[seat], this.trick, this.contract, seat)) {
      throw new Error("Ongeldige zet");
    }
    const idx = this.hands[seat].findIndex((c) => cardEquals(c, card));
    this.hands[seat].splice(idx, 1);
    this.trick.push({ seat, card });

    if (this.trick.length === 4) {
      this.resolveTrick();
    } else {
      this.turn = nextSeat(seat);
    }
  }

  private resolveTrick(): void {
    const winnerSeat = trickWinnerSeat(this.trick, this.contract);
    const cardPts = this.trick.reduce((s, p) => s + cardPoints(p.card, this.contract), 0);
    const roem = roemInTrick(
      this.trick.map((p) => p.card),
      this.contract,
    );
    const isLast = this.completed.length === 7;
    this.completed.push({
      plays: [...this.trick],
      winnerSeat,
      winnerTeam: teamOf(winnerSeat),
      cardPoints: cardPts,
      roem,
      isLast,
    });
    this.trick = [];
    this.turn = winnerSeat; // winnaar komt uit voor de volgende slag
  }

  /** Eindscore van de ronde (alleen na afloop). */
  result(): RoundResult {
    if (!this.isComplete) throw new Error("De ronde is nog niet afgelopen");
    const tricks: TrickResult[] = this.completed.map((t) => ({
      winnerTeam: t.winnerTeam,
      cardPoints: t.cardPoints,
      roem: t.roem,
      isLast: t.isLast,
    }));
    return scoreRound({
      contract: this.contract,
      bid: this.bid,
      makerTeam: this.makerTeam,
      tricks,
    });
  }
}

/** Speelt een hele ronde af met een beslis-functie (bot of scripted). */
export function playRound(config: RoundConfig, decide: (round: Round) => Card): RoundResult {
  const round = new Round(config);
  while (!round.isComplete) {
    round.play(decide(round));
  }
  return round.result();
}
