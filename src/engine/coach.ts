// Review-coach: kijkt na een ronde de zetten van één speler (de mens) na.
// Oordeel is "eerlijk": de Monte-Carlo-evaluator gebruikt alleen wat op dat
// moment zichtbaar was, niet de verborgen handen.

import { Bid, BidAction, evaluateBid } from "./bidding";
import { Card, Contract, cardEquals, cardPoints, trickStrength } from "./cards";
import { Rng } from "./deal";
import { evaluateMoves } from "./montecarlo";
import { Round } from "./round";
import { Play, Seat, Team, partnerOf, trickWinnerSeat } from "./trick";

export type Verdict = "goed" | "twijfel" | "fout";

export interface DecisionReview {
  trickNumber: number;
  trickSoFar: Play[];
  playedCard: Card;
  bestCard: Card;
  /** Gemiddeld puntenverschil tussen de beste zet en jouw zet. */
  gap: number;
  verdict: Verdict;
  explanation: string;
}

export interface BidReview {
  verdict: Verdict;
  explanation: string;
}

export interface RoundReview {
  seat: Seat;
  decisions: DecisionReview[];
  good: number;
  doubtful: number;
  mistakes: number;
  bid: BidReview;
}

export interface HumanBidTurn {
  /** Hoogste bod vóór deze beurt (waarde), of null. */
  highest: number | null;
  action: BidAction;
}

export interface RoundRecord {
  hands: Card[][];
  contract: Contract;
  makerTeam: Team;
  bid: number;
  firstLeader: Seat;
  /** Alle 32 zetten in speelvolgorde. */
  sequence: Play[];
  reviewSeat: Seat;
  humanBids: HumanBidTurn[];
}

const SUIT_WORD: Record<Card["suit"], string> = {
  klaveren: "klaveren",
  harten: "harten",
  ruiten: "ruiten",
  schoppen: "schoppen",
};

function label(c: Card): string {
  return `${c.rank} ${SUIT_WORD[c.suit]}`;
}

const DOUBT_GAP = 3.5;
const MISTAKE_GAP = 10;

function verdictFor(gap: number): Verdict {
  if (gap >= MISTAKE_GAP) return "fout";
  if (gap >= DOUBT_GAP) return "twijfel";
  return "goed";
}

function explainDecision(
  contract: Contract,
  trickSoFar: Play[],
  played: Card,
  best: Card,
  gap: number,
  verdict: Verdict,
  seat: Seat,
): string {
  if (verdict === "goed" || cardEquals(played, best)) return "Prima zet.";

  const better = label(best);

  if (trickSoFar.length === 0) {
    return `Beter uitkomen met ${better} (scheelt gem. ${Math.round(gap)} punten).`;
  }

  const ledSuit = trickSoFar[0].card.suit;
  const currentBest = Math.max(...trickSoFar.map((p) => trickStrength(p.card, contract, ledSuit)));
  const winnerSeat = trickWinnerSeat(trickSoFar, contract);
  const opponentWinning = winnerSeat !== partnerOf(seat);
  const bestBeats = trickStrength(best, contract, ledSuit) > currentBest;
  const playedBeats = trickStrength(played, contract, ledSuit) > currentBest;

  if (opponentWinning && bestBeats && !playedBeats) {
    return `Je liet de slag lopen. Met ${better} had je 'm overgenomen (scheelt gem. ${Math.round(gap)} punten).`;
  }
  if (!bestBeats && !playedBeats && cardPoints(played, contract) > cardPoints(best, contract)) {
    return `Onnodig duur afgegeven; ${better} was zuiniger (scheelt gem. ${Math.round(gap)} punten).`;
  }
  if (!opponentWinning && cardPoints(best, contract) > cardPoints(played, contract)) {
    return `Je maat won de slag al — met ${better} had je meer punten meegegeven (gem. +${Math.round(gap)}).`;
  }
  return `Beter was ${better} (scheelt gem. ${Math.round(gap)} punten).`;
}

function reviewBid(rec: RoundRecord): BidReview {
  const hand = rec.hands[rec.reviewSeat];
  const worth: Bid | null = evaluateBid(hand);
  const madeABid = rec.humanBids.some((b) => b.action !== "pas");

  if (!worth) {
    return madeABid
      ? { verdict: "twijfel", explanation: "Je bood met een vrij zwakke hand — dat is riskant." }
      : { verdict: "goed", explanation: "Terecht gepast: je hand was geen bod waard." };
  }

  const worthLabel =
    worth.contract.type === "sans" ? `${worth.value} sans` : `${worth.value} ${SUIT_WORD[worth.contract.troef]}`;

  if (!madeABid) {
    // Had de mens kunnen/moeten bieden?
    const couldHaveBid = rec.humanBids.some((b) => (b.highest ?? 0) < worth.value);
    return couldHaveBid
      ? {
          verdict: "twijfel",
          explanation: `Je paste, maar je hand was zeker een bod waard (±${worthLabel}).`,
        }
      : { verdict: "goed", explanation: "Terecht gepast: het bieden was al te hoog opgelopen." };
  }

  const humanMax = Math.max(...rec.humanBids.filter((b) => b.action !== "pas").map((b) => (b.action as Bid).value));
  if (humanMax > worth.value) {
    return {
      verdict: "twijfel",
      explanation: `Wat hoog geboden (${humanMax}) voor deze hand; ±${worthLabel} paste beter.`,
    };
  }
  return { verdict: "goed", explanation: `Prima bod voor deze hand (±${worthLabel}).` };
}

export function reviewRound(
  rec: RoundRecord,
  options: { determinizations?: number; rng: Rng },
): RoundReview {
  const round = new Round({
    contract: rec.contract,
    makerTeam: rec.makerTeam,
    bid: rec.bid,
    hands: rec.hands,
    firstLeader: rec.firstLeader,
  });

  const decisions: DecisionReview[] = [];

  for (const play of rec.sequence) {
    if (play.seat === rec.reviewSeat && !round.isComplete) {
      const legal = round.legalMoves();
      if (legal.length > 1) {
        const trickSoFar = [...round.currentTrick];
        const values = evaluateMoves(round, {
          determinizations: options.determinizations ?? 80,
          rng: options.rng,
        });
        const played = values.find((v) => cardEquals(v.card, play.card))?.value ?? 0;
        const best = values.reduce((b, x) => (x.value > b.value ? x : b));
        const gap = best.value - played;
        const verdict = verdictFor(gap);
        decisions.push({
          trickNumber: round.tricks.length + 1,
          trickSoFar,
          playedCard: play.card,
          bestCard: best.card,
          gap,
          verdict,
          explanation: explainDecision(
            rec.contract,
            trickSoFar,
            play.card,
            best.card,
            gap,
            verdict,
            rec.reviewSeat,
          ),
        });
      }
    }
    round.play(play.card);
  }

  return {
    seat: rec.reviewSeat,
    decisions,
    good: decisions.filter((d) => d.verdict === "goed").length,
    doubtful: decisions.filter((d) => d.verdict === "twijfel").length,
    mistakes: decisions.filter((d) => d.verdict === "fout").length,
    bid: reviewBid(rec),
  };
}
