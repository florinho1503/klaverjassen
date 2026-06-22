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

// --- Uitdeling samplen met void-constraints en juiste handgroottes ---

function trySample(
  myHand: Card[],
  me: Seat,
  unseen: Card[],
  counts: number[],
  voids: Record<Seat, Set<Suit>>,
  rng: Rng,
  honorVoids: boolean,
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

  // Meest beperkte kaarten eerst (minste mogelijke ontvangers), daarna willekeurig.
  const ordered = shuffle(unseen, rng).sort(
    (a, b) => eligibleSeats(a.suit).length - eligibleSeats(b.suit).length,
  );

  for (const c of ordered) {
    const elig = eligibleSeats(c.suit);
    if (elig.length === 0) return null;
    const pick = elig[Math.floor(rng() * elig.length)];
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
): Card[][] | null {
  for (let t = 0; t < 30; t++) {
    const res = trySample(myHand, me, unseen, counts, voids, rng, true);
    if (res) return res;
  }
  // Lukt het niet met voids, laat de constraint dan vallen (zeldzaam).
  return trySample(myHand, me, unseen, counts, voids, rng, false);
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

export function makeMonteCarloBot(options: MonteCarloOptions = {}): Bot {
  const N = options.determinizations ?? 60;
  const rng = options.rng ?? Math.random;

  return (round: Round): Card => {
    const legal = round.legalMoves();
    if (legal.length === 1) return legal[0];

    const a = analyzeRound(round);
    const myTeam: Team = a.team;
    const counts = [0, 1, 2, 3].map((s) => round.handOf(s as Seat).length);
    const totals = legal.map(() => 0);
    let samples = 0;

    for (let i = 0; i < N; i++) {
      const sampled = sampleDeal(a.myHand, a.me, a.unseen, counts, a.voids, rng);
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
      });
    }

    if (samples === 0) return mediumBot(round); // fallback als sampelen faalt

    let bestIdx = 0;
    for (let i = 1; i < legal.length; i++) if (totals[i] > totals[bestIdx]) bestIdx = i;
    return legal[bestIdx];
  };
}

export const hardBot: Bot = makeMonteCarloBot();
