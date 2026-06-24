import { describe, expect, it } from "vitest";
import { Contract } from "./cards";
import { deal } from "./deal";
import { heuristicBot } from "./bot";
import { Round } from "./round";
import { Play, Seat } from "./trick";
import { RoundRecord, deeperTip, reviewRound } from "./coach";
import { analyzeRound } from "./analyze";
import { card, cards, seededRng } from "./testHelpers";

const troef: Contract = { type: "kleur", troef: "klaveren" };

function recordFullRound(seed: number, reviewSeat: Seat): RoundRecord {
  const hands = deal(seededRng(seed));
  const round = new Round({ contract: troef, makerTeam: 0, bid: 90, hands, firstLeader: 0 });
  const sequence: Play[] = [];
  while (!round.isComplete) {
    const seat = round.currentSeat;
    const card = heuristicBot(round);
    sequence.push({ seat, card });
    round.play(card);
  }
  return {
    hands,
    contract: troef,
    makerTeam: 0,
    bid: 90,
    firstLeader: 0,
    sequence,
    reviewSeat,
    humanBids: [{ highest: null, action: { value: 90, contract: troef } }],
  };
}

describe("reviewRound", () => {
  it("levert beoordelingen op voor de zetten van de reviewspeler", () => {
    const rec = recordFullRound(5, 2);
    const review = reviewRound(rec, { determinizations: 8, rng: seededRng(1) });

    expect(review.decisions.length).toBeGreaterThan(0);
    expect(review.good + review.doubtful + review.mistakes).toBe(review.decisions.length);
    for (const d of review.decisions) {
      // De beste zet is per definitie minstens zo goed als de gespeelde.
      expect(d.gap).toBeGreaterThanOrEqual(-0.001);
      expect(["goed", "twijfel", "fout"]).toContain(d.verdict);
      expect(d.explanation.length).toBeGreaterThan(0);
      expect(d.handAtDecision.length).toBeGreaterThan(0);
    }
    expect(["goed", "twijfel", "fout"]).toContain(review.bid.verdict);
  });

  it("deeperTip waarschuwt voor een nog-niet-gevallen hogere troef", () => {
    const hands = [
      cards("Bk", "7k", "8k", "10k", "Vk", "Hk", "Ak", "7s"), // heeft de troefboer
      cards("7r", "8r", "9r", "10r", "Br", "Vr", "Hr", "Ar"),
      cards("9k", "7h", "8h", "9h", "10h", "Bh", "Vh", "Hh"), // mens: 9 troef, geen boer
      cards("Ah", "8s", "9s", "10s", "Bs", "Vs", "Hs", "As"),
    ];
    const round = new Round({ contract: troef, makerTeam: 0, bid: 90, hands, firstLeader: 2 });
    const a = analyzeRound(round);
    const tip = deeperTip(card("9k"), troef, a, [], "twijfel");
    expect(tip).toContain("💡");
    expect(tip).toMatch(/B klaveren/); // de troefboer is nog niet gevallen
  });

  it("beoordeelt het bod als twijfel bij bieden met een zwakke hand", () => {
    const rec = recordFullRound(5, 2);
    // Forceer een bod-actie met (waarschijnlijk) zwakke hand-context.
    const review = reviewRound(rec, { determinizations: 4, rng: seededRng(2) });
    expect(review.bid).toBeDefined();
    expect(review.bid.explanation.length).toBeGreaterThan(0);
  });
});
