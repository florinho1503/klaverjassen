import { describe, expect, it } from "vitest";
import { Card, Contract, cardToString } from "./cards";
import { Round } from "./round";
import { analyzeRound } from "./analyze";
import { card, cards } from "./testHelpers";

const troef: Contract = { type: "kleur", troef: "klaveren" };

function suitSplitHands(): Card[][] {
  return [
    cards("Ah", "7h", "8h", "9h", "10h", "Bh", "Vh", "Hh"),
    cards("Ak", "7k", "8k", "9k", "10k", "Bk", "Vk", "Hk"),
    cards("Ar", "7r", "8r", "9r", "10r", "Br", "Vr", "Hr"),
    cards("As", "7s", "8s", "9s", "10s", "Bs", "Vs", "Hs"),
  ];
}

describe("analyzeRound", () => {
  it("kent 24 ongeziene kaarten aan het begin (8 in de hand, 0 gespeeld)", () => {
    const round = new Round({ contract: troef, makerTeam: 0, bid: 90, hands: suitSplitHands() });
    const a = analyzeRound(round);
    expect(a.myHand).toHaveLength(8);
    expect(a.played).toHaveLength(0);
    expect(a.unseen).toHaveLength(24);
    const all = [...a.myHand, ...a.unseen].map(cardToString);
    expect(new Set(all).size).toBe(32);
  });

  it("registreert renonces en leest het sein van de maat", () => {
    const round = new Round({ contract: troef, makerTeam: 0, bid: 90, hands: suitSplitHands() });
    round.play(card("7h")); // seat0 komt uit met harten
    round.play(card("7k")); // seat1 troeft (kan harten niet bekennen)
    round.play(card("7r")); // seat2 gooit af
    round.play(card("7s")); // seat3 gooit af (laag = aanseinen schoppen)
    // seat1 wint met troef en is aan zet.
    const a = analyzeRound(round);
    expect(a.me).toBe(1);
    expect(a.voids[3].has("harten")).toBe(true);
    expect(a.voids[2].has("harten")).toBe(true);
    // maat van seat1 is seat3, die schoppen aanseinde
    expect(a.partnerSignals).toContain("schoppen");
  });

  it("isHighestOfSuit: aas is hoogste, 10 niet als de aas nog buiten zit", () => {
    const split = analyzeRound(
      new Round({ contract: troef, makerTeam: 0, bid: 90, hands: suitSplitHands() }),
    );
    expect(split.isHighestOfSuit(card("Ah"))).toBe(true);

    const hands: Card[][] = [
      cards("10h", "7h", "8h", "9h", "7k", "8k", "9k", "10k"), // geen harten-aas
      cards("Ah", "Bh", "Vh", "Hh", "Ak", "Bk", "Vk", "Hk"),
      cards("Ar", "7r", "8r", "9r", "10r", "Br", "Vr", "Hr"),
      cards("As", "7s", "8s", "9s", "10s", "Bs", "Vs", "Hs"),
    ];
    const a = analyzeRound(new Round({ contract: troef, makerTeam: 0, bid: 90, hands }));
    expect(a.isHighestOfSuit(card("10h"))).toBe(false); // Ah zit nog buiten
  });
});
