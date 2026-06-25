// Moeilijk-bot: determinized Monte-Carlo (Perfect Information Monte Carlo).
//
// Bij elke beslissing:
//  1. bepaal de ongeziene kaarten (in de andere 3 handen);
//  2. deel die N keer willekeurig uit over de andere spelers, met respect voor
//     bekende renonces (voids) en de juiste handgroottes;
//  3. speel per uitdeling elke legale zet uit met een snelle policy en scoor;
//  4. kies de zet met de beste gemiddelde score (vanuit mijn team gezien).

import {
  Card,
  Contract,
  Suit,
  cardEquals,
  cardPoints,
  isTrump,
  trickStrength,
} from "./cards";
import { analyzeRound } from "./analyze";
import type { AuctionLogEntry } from "./bidding";
import type { Bot } from "./bot";
import { Rng, shuffle } from "./deal";
import { legalMoves } from "./legalMoves";
import { mediumBot } from "./mediumBot";
import { roemInTrick } from "./roem";
import { Round } from "./round";
import { TrickResult, scoreRound } from "./scoring";
import { Play, Seat, Team, nextSeat, partnerOf, teamOf, trickWinnerSeat } from "./trick";

// --- Snelle rollout-policy (geen zware analyse, want dit draait duizenden keren) ---

function rolloutPick(legal: Card[], trick: Play[], contract: Contract, seat: Seat): Card {
  if (legal.length === 1) return legal[0];
  const pts = (c: Card) => cardPoints(c, contract);

  if (trick.length === 0) {
    // Uitkomen: cash hoog (hoogste niet-troef), anders hoogste.
    const nonTrump = legal.filter((c) => !isTrump(c, contract));
    const pool = nonTrump.length ? nonTrump : legal;
    return [...pool].sort((a, b) => pts(b) - pts(a))[0];
  }

  const ledSuit = trick[0].card.suit;
  const best = Math.max(...trick.map((p) => trickStrength(p.card, contract, ledSuit)));
  const partnerWinning = trickWinnerSeat(trick, contract) === partnerOf(seat);
  const winners = legal
    .filter((c) => trickStrength(c, contract, ledSuit) > best)
    .sort((a, b) => trickStrength(a, contract, ledSuit) - trickStrength(b, contract, ledSuit));

  if (partnerWinning) {
    const isLast = trick.length === 3;
    return [...legal].sort((a, b) => (isLast ? pts(b) - pts(a) : pts(a) - pts(b)))[0];
  }
  if (winners.length) return winners[0];
  return [...legal].sort((a, b) => pts(a) - pts(b))[0];
}

// --- Bied-inferentie: zachte weging van wie welke kaart waarschijnlijk heeft ---

type Affinity = (seat: Seat, card: Card) => number;

const UNIFORM: Affinity = () => 1;

/**
 * Leidt uit het biedverloop zachte voorkeuren af: wie een kleur bood heeft daar
 * waarschijnlijk de honneurs (B/9) + azen; wie sans bood azen/tienen; wie alleen
 * paste eerder een zwakke hand. Bewust mild (bluffen mag).
 */
export function buildAffinity(bids: AuctionLogEntry[]): Affinity {
  const colour: Record<Seat, Set<string>> = { 0: new Set(), 1: new Set(), 2: new Set(), 3: new Set() };
  const sans: Record<Seat, boolean> = { 0: false, 1: false, 2: false, 3: false };
  const everBid: Record<Seat, boolean> = { 0: false, 1: false, 2: false, 3: false };

  for (const e of bids) {
    if (e.action === "pas") continue;
    everBid[e.seat] = true;
    if (e.action.contract.type === "sans") sans[e.seat] = true;
    else colour[e.seat].add(e.action.contract.troef);
  }

  return (seat, card) => {
    let w = 1;
    if (colour[seat].has(card.suit) && (card.rank === "B" || card.rank === "9")) w *= 1.8;
    if (colour[seat].size > 0 && card.rank === "A") w *= 1.25;
    if (sans[seat] && (card.rank === "A" || card.rank === "10")) w *= 1.5;
    if (!everBid[seat] && ["B", "9", "A", "10"].includes(card.rank)) w *= 0.8;
    return w;
  };
}

// --- Uitdeling samplen met void-constraints en juiste handgroottes ---

function trySample(
  myHand: Card[],
  me: Seat,
  unseen: Card[],
  counts: number[],
  voids: Record<Seat, Set<Suit>>,
  rng: Rng,
  honorVoids: boolean,
  affinity: Affinity,
): Card[][] | null {
  const others = ([0, 1, 2, 3] as Seat[]).filter((s) => s !== me);
  const need: Record<number, number> = {};
  const assigned: Record<number, Card[]> = {};
  for (const s of others) {
    need[s] = counts[s];
    assigned[s] = [];
  }

  const eligibleSeats = (suit: Suit) =>
    others.filter((s) => need[s] > 0 && (!honorVoids || !voids[s].has(suit)));

  // Meest beperkte kaarten eerst (minste mogelijke ontvangers), daarna gewogen.
  const ordered = shuffle(unseen, rng).sort(
    (a, b) => eligibleSeats(a.suit).length - eligibleSeats(b.suit).length,
  );

  for (const c of ordered) {
    const elig = eligibleSeats(c.suit);
    if (elig.length === 0) return null;
    // Gewogen keuze op basis van bied-inferentie.
    const weights = elig.map((s) => affinity(s, c));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    let pick = elig[elig.length - 1];
    for (let i = 0; i < elig.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        pick = elig[i];
        break;
      }
    }
    assigned[pick].push(c);
    need[pick]--;
  }

  const hands: Card[][] = [[], [], [], []];
  for (let s = 0; s < 4; s++) hands[s] = s === me ? [...myHand] : assigned[s];
  return hands;
}

function sampleDeal(
  myHand: Card[],
  me: Seat,
  unseen: Card[],
  counts: number[],
  voids: Record<Seat, Set<Suit>>,
  rng: Rng,
  affinity: Affinity,
): Card[][] | null {
  for (let t = 0; t < 30; t++) {
    const res = trySample(myHand, me, unseen, counts, voids, rng, true, affinity);
    if (res) return res;
  }
  // Lukt het niet met voids, laat de constraint dan vallen (zeldzaam).
  return trySample(myHand, me, unseen, counts, voids, rng, false, affinity);
}

// --- Eén ronde uitspelen vanaf de huidige (deel)stand ---

function simulateMove(round: Round, sampledHands: Card[][], firstMove: Card): TrickResult[] {
  const contract = round.contract;
  const hands = sampledHands.map((h) => [...h]);
  const completed: TrickResult[] = round.tricks.map((t) => ({
    winnerTeam: t.winnerTeam,
    cardPoints: t.cardPoints,
    roem: t.roem,
    isLast: t.isLast,
  }));
  let trick: Play[] = [...round.currentTrick];
  let turn: Seat = round.currentSeat;

  const play = (card: Card) => {
    const i = hands[turn].findIndex((c) => cardEquals(c, card));
    hands[turn].splice(i, 1);
    trick.push({ seat: turn, card });
    if (trick.length === 4) {
      const winner = trickWinnerSeat(trick, contract);
      const cardPts = trick.reduce((s, p) => s + cardPoints(p.card, contract), 0);
      const roem = roemInTrick(
        trick.map((p) => p.card),
        contract,
      );
      completed.push({
        winnerTeam: teamOf(winner),
        cardPoints: cardPts,
        roem,
        isLast: completed.length === 7,
      });
      trick = [];
      turn = winner;
    } else {
      turn = nextSeat(turn);
    }
  };

  play(firstMove);
  while (completed.length < 8) {
    const legal = legalMoves(hands[turn], trick, contract, turn);
    play(rolloutPick(legal, trick, contract, turn));
  }
  return completed;
}

export interface MonteCarloOptions {
  /** Aantal uitdelingen per beslissing (meer = sterker maar trager). */
  determinizations?: number;
  rng?: Rng;
}

export interface MoveValue {
  card: Card;
  /** Gemiddeld puntenverschil (mijn team − tegenpartij) over de uitdelingen. */
  value: number;
  /** Aandeel uitdelingen waarin de maker zijn bod haalt (niet nat). */
  makeRate: number;
}

/**
 * Scoort elke legale zet via Monte-Carlo en geeft het gemiddelde puntenverschil
 * (vanuit het team aan zet). Hergebruikt door de bot én de review-coach.
 */
export function evaluateMoves(round: Round, options: MonteCarloOptions = {}): MoveValue[] {
  const N = options.determinizations ?? 60;
  const rng = options.rng ?? Math.random;

  const legal = round.legalMoves();
  if (legal.length === 0) return [];

  const a = analyzeRound(round);
  const myTeam: Team = a.team;
  const counts = [0, 1, 2, 3].map((s) => round.handOf(s as Seat).length);
  const affinity = round.bids.length > 0 ? buildAffinity(round.bids) : UNIFORM;
  const totals = legal.map(() => 0);
  const made = legal.map(() => 0);
  let samples = 0;

  for (let i = 0; i < N; i++) {
    const sampled = sampleDeal(a.myHand, a.me, a.unseen, counts, a.voids, rng, affinity);
    if (!sampled) continue;
    samples++;
    legal.forEach((move, idx) => {
      const tricks = simulateMove(round, sampled, move);
      const res = scoreRound({
        contract: round.contract,
        bid: round.bid,
        makerTeam: round.makerTeam,
        tricks,
      });
      totals[idx] += res.points[myTeam] - res.points[myTeam === 0 ? 1 : 0];
      if (!res.nat) made[idx] += 1;
    });
  }

  return legal.map((card, idx) => ({
    card,
    value: samples ? totals[idx] / samples : 0,
    makeRate: samples ? made[idx] / samples : 0,
  }));
}

export function makeMonteCarloBot(options: MonteCarloOptions = {}): Bot {
  return (round: Round): Card => {
    const legal = round.legalMoves();
    if (legal.length === 1) return legal[0];
    const values = evaluateMoves(round, options);
    if (values.length === 0) return mediumBot(round); // fallback als sampelen faalt
    return values.reduce((best, x) => (x.value > best.value ? x : best)).card;
  };
}

export const hardBot: Bot = makeMonteCarloBot();
