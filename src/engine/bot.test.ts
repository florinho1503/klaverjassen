import { describe, expect, it } from "vitest";
import { Card, Contract } from "./cards";
import { deal } from "./deal";
import { Round, playRound } from "./round";
import { heuristicBot, randomBot } from "./bot";
import { cards, seededRng } from "./testHelpers";

const troef: Contract = { type: "kleur", troef: "klaveren" };

/** 4 handen, elk een hele kleur — handig om bot-keuzes te sturen. */
function suitSplitHands(): Card[][] {
  return [
    cards("Ah", "7h", "8h", "9h", "10h", "Bh", "Vh", "Hh"),
    cards("Ak", "7k", "8k", "9k", "10k", "Bk", "Vk", "Hk"),
    cards("Ar", "7r", "8r", "9r", "10r", "Br", "Vr", "Hr"),
    cards("As", "7s", "8s", "9s", "10s", "Bs", "Vs", "Hs"),
  ];
}

describe("heuristicBot — keuzes", () => {
  it("speelt bij uitkomen een niet-troef aas", () => {
    const round = new Round({ contract: troef, makerTeam: 0, bid: 90, hands: suitSplitHands() });
    const chosen = heuristicBot(round); // seat 0 komt uit
    expect(chosen).toEqual({ suit: "harten", rank: "A" });
  });

  it("neemt de slag van de tegenstander zo goedkoop mogelijk over (laagste troef)", () => {
    const round = new Round({ contract: troef, makerTeam: 0, bid: 90, hands: suitSplitHands() });
    round.play(cards("7h")[0]); // seat0 komt uit met harten 7
    // seat1 heeft alleen klaveren (troef), tegenstander seat0 wint → introeven met laagste troef
    const chosen = heuristicBot(round);
    expect(chosen).toEqual({ suit: "klaveren", rank: "7" });
  });
});

describe("bots — volledige rondes", () => {
  it("heuristicBot speelt elke ronde legaal uit (meerdere seeds)", () => {
    for (const seed of [1, 2, 3, 17, 99, 256]) {
      const res = playRound(
        { contract: troef, makerTeam: 0, bid: 90, hands: deal(seededRng(seed)), firstLeader: 0 },
        heuristicBot,
      );
      expect(typeof res.nat).toBe("boolean");
    }
  });

  it("randomBot speelt een ronde legaal uit", () => {
    const rng = seededRng(2024);
    const res = playRound(
      { contract: troef, makerTeam: 0, bid: 90, hands: deal(seededRng(11)), firstLeader: 0 },
      randomBot(rng),
    );
    expect(typeof res.nat).toBe("boolean");
  });

  it("sans-ronde speelt ook legaal uit", () => {
    const res = playRound(
      { contract: { type: "sans" }, makerTeam: 1, bid: 80, hands: deal(seededRng(8)), firstLeader: 1 },
      heuristicBot,
    );
    expect(typeof res.nat).toBe("boolean");
  });
});
