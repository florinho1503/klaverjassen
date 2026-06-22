// Bots: kiezen een geldige zet voor de speler die aan zet is.
//
// - randomBot: willekeurige geldige zet (baseline / testen).
// - heuristicBot: simpele, redelijke klaverjas-heuristiek (geen diepe analyse):
//     * uitkomen: speel een niet-troef aas (pak punten), anders je laagste kaart;
//     * maat wint de slag: als laatste speler punten meegeven (hoogste), anders laag bewaren;
//     * tegenstander wint: zo goedkoop mogelijk overnemen als dat kan, anders laagste afgooien.

import { Card, cardPoints, isTrump, trickStrength } from "./cards";
import { Rng } from "./deal";
import { mediumBot } from "./mediumBot";
import { Round } from "./round";
import { partnerOf, trickWinnerSeat } from "./trick";

export type Bot = (round: Round) => Card;

export type Difficulty = "makkelijk" | "middel" | "moeilijk";

/**
 * Kies de speelbot voor een niveau. Middel/moeilijk vallen voorlopig terug op
 * de heuristische bot; ze worden in fase 2 en 3 vervangen.
 */
export function cardBotFor(difficulty: Difficulty): Bot {
  switch (difficulty) {
    case "makkelijk":
      return heuristicBot;
    case "middel":
      return mediumBot;
    case "moeilijk":
      return mediumBot; // TODO fase 3: hardBot (heuristiek + Monte-Carlo)
  }
}

export function randomBot(rng: Rng = Math.random): Bot {
  return (round) => {
    const legal = round.legalMoves();
    return legal[Math.floor(rng() * legal.length)];
  };
}

export const heuristicBot: Bot = (round) => {
  const legal = round.legalMoves();
  if (legal.length === 1) return legal[0];

  const { contract } = round;
  const trick = round.currentTrick;
  const seat = round.currentSeat;

  const points = (c: Card) => cardPoints(c, contract);
  const byPoints = [...legal].sort((a, b) => points(a) - points(b));
  const lowest = byPoints[0];
  const highest = byPoints[byPoints.length - 1];

  // Uitkomen.
  if (trick.length === 0) {
    const ace = legal.find((c) => c.rank === "A" && !isTrump(c, contract));
    return ace ?? lowest;
  }

  const ledSuit = trick[0].card.suit;
  const winnerSeat = trickWinnerSeat([...trick], contract);
  const bestStrength = Math.max(
    ...trick.map((p) => trickStrength(p.card, contract, ledSuit)),
  );
  const partnerWinning = winnerSeat === partnerOf(seat);
  const isLast = trick.length === 3;

  if (partnerWinning) {
    // Maat wint: als laatste speler punten meegeven, anders laag houden.
    return isLast ? highest : lowest;
  }

  // Tegenstander wint: kaarten die de slag overnemen.
  const winners = legal
    .filter((c) => trickStrength(c, contract, ledSuit) > bestStrength)
    .sort(
      (a, b) =>
        trickStrength(a, contract, ledSuit) - trickStrength(b, contract, ledSuit),
    );

  // Win zo goedkoop mogelijk (laagste winnende kaart), anders gooi laagste af.
  return winners[0] ?? lowest;
};
