// Review-coach: kijkt na een ronde de zetten van één speler (de mens) na.
// Oordeel is "eerlijk": de Monte-Carlo-evaluator gebruikt alleen wat op dat
// moment zichtbaar was, niet de verborgen handen.

import { RoundAnalysis, analyzeRound } from "./analyze";
import { Bid, BidAction, evaluateBid } from "./bidding";
import { Card, Contract, cardEquals, cardPoints, isTrump, trickStrength } from "./cards";
import { Rng } from "./deal";
import { evaluateMoves } from "./montecarlo";
import { Round } from "./round";
import { Play, Seat, Team, partnerOf, trickWinnerSeat } from "./trick";

export type Verdict = "goed" | "twijfel" | "fout";

export interface DecisionReview {
  trickNumber: number;
  trickSoFar: Play[];
  /** Jouw hand op het moment van deze beslissing. */
  handAtDecision: Card[];
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

// Drempels bewust ruim: Monte-Carlo heeft ruis, dus alleen duidelijke
// verschillen markeren als verbeterpunt/fout (anders nag je over dichte keuzes).
const DOUBT_GAP = 7;
const MISTAKE_GAP = 18;

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
  const bestIsTrump = isTrump(best, contract);
  const ledIsTrump = contract.type === "kleur" && ledSuit === contract.troef;
  const g = Math.round(gap);

  if (opponentWinning && bestBeats && !playedBeats) {
    if (bestIsTrump && !ledIsTrump) {
      return `Je had kunnen introeven met ${better} en de slag (met de punten) pakken — nu ging die naar de tegenstander (scheelt gem. ${g}).`;
    }
    if (bestIsTrump && ledIsTrump) {
      return `${better} is hier de hoogste troef: daarmee troef je over de tegenstander heen en pak je de slag. Laag bijspelen geeft de slag (en de punten) weg (scheelt gem. ${g}).`;
    }
    return `Je liet de slag lopen — met ${better} had je 'm overgenomen (scheelt gem. ${g} punten).`;
  }
  if (!bestBeats && !playedBeats && cardPoints(played, contract) > cardPoints(best, contract)) {
    return `Onnodig duur afgegeven; ${better} was zuiniger (scheelt gem. ${g} punten).`;
  }
  if (!opponentWinning && cardPoints(best, contract) > cardPoints(played, contract)) {
    return `Je maat won de slag al — met ${better} had je meer punten meegegeven (gem. +${g}).`;
  }
  if (opponentWinning && !bestBeats && !playedBeats && cardPoints(best, contract) > cardPoints(played, contract)) {
    return `Je verliest deze slag hoe dan ook, maar gooi dan liever de hogere ${better} af — die raak je later toch kwijt, en zo vallen die punten vaker aan je eigen kant (scheelt gem. ${g}).`;
  }
  return `Beter was ${better} (scheelt gem. ${g} punten).`;
}

/**
 * Diepere, kaart-tellende tip: welke hogere kaarten van dezelfde kleur zijn nog
 * niet gevallen, en zit je maat die kleur al kwijt? (Alleen bij een gemarkeerde zet.)
 */
export function deeperTip(
  played: Card,
  contract: Contract,
  a: RoundAnalysis,
  trickSoFar: Play[],
  verdict: Verdict,
): string {
  if (verdict === "goed") return "";

  const higher = a.unseen.filter(
    (u) =>
      u.suit === played.suit &&
      trickStrength(u, contract, played.suit) > trickStrength(played, contract, played.suit),
  );
  if (higher.length === 0) return "";

  const top = higher.reduce((x, y) =>
    trickStrength(y, contract, played.suit) > trickStrength(x, contract, played.suit) ? y : x,
  );
  const partnerVoid = a.voids[a.partner].has(played.suit);

  if (isTrump(played, contract)) {
    return partnerVoid
      ? ` 💡 De ${label(top)} is nog niet gevallen én je maat zit zonder troef — die hoogste troef heeft dus een tegenstander, en je ${label(played)} kan er nog onder.`
      : ` 💡 De ${label(top)} is nog niet gevallen, dus je ${label(played)} is nog niet de baas in troef.`;
  }
  if (trickSoFar.length === 0) {
    return ` 💡 Je kwam uit met ${label(played)}, maar de ${label(top)} is nog niet gevallen — die kan 'm pakken.`;
  }
  return "";
}

function reviewBid(rec: RoundRecord): BidReview {
  const hand = rec.hands[rec.reviewSeat];
  const worth: Bid | null = evaluateBid(hand);
  const worthLabel = worth
    ? worth.contract.type === "sans"
      ? `${worth.value} sans`
      : `${worth.value} ${SUIT_WORD[worth.contract.troef]}`
    : null;

  // Het laagste bod dat op dat moment nog mogelijk was (rekening houdend met
  // wat er al geboden was) — niet wat je hand "waard" is.
  const minToBid = (highest: number | null): number => {
    if (highest != null) return highest + 10;
    return worth && worth.contract.type === "sans" ? 70 : 80;
  };

  const madeBids = rec.humanBids.filter((b) => b.action !== "pas");

  if (madeBids.length > 0) {
    const theirTurn = madeBids.reduce((a, b) =>
      (b.action as Bid).value > (a.action as Bid).value ? b : a,
    );
    const theirValue = (theirTurn.action as Bid).value;
    const min = minToBid(theirTurn.highest);

    if (worth && theirValue <= worth.value) {
      return { verdict: "goed", explanation: `Prima bod (±${worthLabel}).` };
    }
    if (worth && worth.value >= min) {
      // Lager bieden was mogelijk én genoeg geweest.
      return {
        verdict: "twijfel",
        explanation: `Je bood ${theirValue}, maar het minimum (${min}) was met deze hand (±${worthLabel}) al genoeg.`,
      };
    }
    // Om mee te doen moest je boven je hand bieden — gedurfd.
    const w = worth ? `±${worthLabel}` : "eigenlijk geen bod";
    return {
      verdict: "twijfel",
      explanation: `Gedurfd bod: je hand was ${w} waard en er lag al ${theirTurn.highest ?? 0}, dus je moest minstens ${min}. Passen kon ook.`,
    };
  }

  // Alleen gepast.
  if (!worth) {
    return { verdict: "goed", explanation: "Terecht gepast: je hand was geen bod waard." };
  }
  const firstMin = minToBid(rec.humanBids[0]?.highest ?? null);
  if (worth.value >= firstMin) {
    return {
      verdict: "twijfel",
      explanation: `Je paste, maar je hand (±${worthLabel}) was nog een bod waard (minimaal ${firstMin}).`,
    };
  }
  return { verdict: "goed", explanation: "Terecht gepast: het bieden liep te hoog op voor je hand." };
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
        const handAtDecision = [...round.handOf(rec.reviewSeat)];
        const analysis = analyzeRound(round);
        const values = evaluateMoves(round, {
          determinizations: options.determinizations ?? 80,
          rng: options.rng,
        });
        const played = values.find((v) => cardEquals(v.card, play.card))?.value ?? 0;
        const best = values.reduce((b, x) => (x.value > b.value ? x : b));
        const gap = best.value - played;
        const verdict = verdictFor(gap);
        const explanation =
          explainDecision(rec.contract, trickSoFar, play.card, best.card, gap, verdict, rec.reviewSeat) +
          deeperTip(play.card, rec.contract, analysis, trickSoFar, verdict);
        decisions.push({
          trickNumber: round.tricks.length + 1,
          trickSoFar,
          handAtDecision,
          playedCard: play.card,
          bestCard: best.card,
          gap,
          verdict,
          explanation,
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
