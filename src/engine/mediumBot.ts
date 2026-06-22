// Middel-bot: kaartgeheugen, troefbeheer, slim bijspelen en seinen.
// Speelt merkbaar sterker dan heuristicBot, maar zonder zoekalgoritme.

import { Card, cardPoints, isTrump, trickStrength } from "./cards";
import { analyzeRound } from "./analyze";
import type { Bot } from "./bot";
import { Round } from "./round";
import { trickWinnerSeat } from "./trick";

const NATURAL_RANKS = ["7", "8", "9", "10", "B", "V", "H", "A"];
const rankIdx = (c: Card) => NATURAL_RANKS.indexOf(c.rank);

export const mediumBot: Bot = (round: Round): Card => {
  const legal = round.legalMoves();
  if (legal.length === 1) return legal[0];

  const contract = round.contract;
  const trick = round.currentTrick;
  const a = analyzeRound(round);

  const pts = (c: Card) => cardPoints(c, contract);
  const strength = (c: Card, ledSuit: Card["suit"]) => trickStrength(c, contract, ledSuit);
  const lowest = (cs: Card[]) => [...cs].sort((x, y) => pts(x) - pts(y) || rankIdx(x) - rankIdx(y))[0];
  const highest = (cs: Card[]) => [...cs].sort((x, y) => pts(y) - pts(x) || rankIdx(y) - rankIdx(x))[0];

  // ---- Uitkomen ----
  if (trick.length === 0) {
    const myTrumps = a.myHand.filter((c) => isTrump(c, contract));
    const trumpsLegal = legal.filter((c) => isTrump(c, contract));
    const weAreMaker = a.team === round.makerTeam;
    const haveJas = myTrumps.some((c) => c.rank === "B");

    // Maker met sterke troef: troef trekken zolang er nog troef buiten zit.
    if (
      contract.type === "kleur" &&
      weAreMaker &&
      a.trumpsOut > 0 &&
      trumpsLegal.length > 0 &&
      (haveJas || myTrumps.length >= 3)
    ) {
      return [...trumpsLegal].sort(
        (x, y) => strength(y, contract.troef) - strength(x, contract.troef),
      )[0];
    }

    // Maat seinde een kleur aan → speel die (laag, zodat de maat 'm pakt).
    for (const suit of a.partnerSignals) {
      const inSuit = legal.filter((c) => c.suit === suit && !isTrump(c, contract));
      if (inSuit.length) return lowest(inSuit);
    }

    // Cash een "baas"-kaart (hoogste van zijn kleur die nog leeft), liefst een aas.
    const boss = legal.filter((c) => !isTrump(c, contract) && a.isHighestOfSuit(c));
    if (boss.length) return highest(boss);

    // Anders: laagste niet-troef bewaren/afgeven.
    const nonTrump = legal.filter((c) => !isTrump(c, contract));
    return lowest(nonTrump.length ? nonTrump : legal);
  }

  // ---- Bijspelen ----
  const ledSuit = trick[0].card.suit;
  const best = Math.max(...trick.map((p) => strength(p.card, ledSuit)));
  const winnerSeat = trickWinnerSeat([...trick], contract);
  const partnerWinning = winnerSeat === a.partner;
  const isLast = trick.length === 3;
  const winners = legal
    .filter((c) => strength(c, ledSuit) > best)
    .sort((x, y) => strength(x, ledSuit) - strength(y, ledSuit));

  if (partnerWinning) {
    const winningCard = trick.find((p) => p.seat === winnerSeat)!.card;
    const beatable = a.unseen.some((u) => strength(u, ledSuit) > strength(winningCard, ledSuit));
    // Punten meegeven als het veilig is (ik ben laatste, of niemand kan er nog overheen).
    if (isLast || !beatable) return highest(legal);
    return lowest(legal);
  }

  // Tegenstander wint: zo goedkoop mogelijk overnemen.
  if (winners.length) return winners[0];

  // Kan niet winnen → afgooien. Sein desnoods een sterke kleur aan.
  const aansein = legal.find(
    (c) =>
      !isTrump(c, contract) &&
      (c.rank === "7" || c.rank === "8" || c.rank === "9") &&
      a.myHand.some((h) => h.suit === c.suit && h.rank === "A"),
  );
  if (aansein) return aansein;
  return lowest(legal);
};
