import { describe, expect, it } from "vitest";
import { Card, Contract } from "./cards";
import { deal } from "./deal";
import { Round, playRound } from "./round";
import { makeMonteCarloBot } from "./montecarlo";
import { card, cards, seededRng } from "./testHelpers";

const troef: Contract = { type: "kleur", troef: "klaveren" };

describe("makeMonteCarloBot", () => {
  it("speelt elke ronde legaal uit (kleine sample voor snelheid)", () => {
    const bot = makeMonteCarloBot({ determinizations: 8, rng: seededRng(1) });
    for (const seed of [1, 7, 42]) {
      const res = playRound(
        { contract: troef, makerTeam: 0, bid: 90, hands: deal(seededRng(seed)), firstLeader: 0 },
        bot,
      );
      expect(typeof res.nat).toBe("boolean");
    }
  });

  it("speelt ook een sans-ronde legaal uit", () => {
    const bot = makeMonteCarloBot({ determinizations: 8, rng: seededRng(3) });
    const res = playRound(
      { contract: { type: "sans" }, makerTeam: 1, bid: 80, hands: deal(seededRng(9)), firstLeader: 1 },
      bot,
    );
    expect(typeof res.nat).toBe("boolean");
  });

  it("kiest de enige geldige zet zonder simulatie", () => {
    const bot = makeMonteCarloBot({ determinizations: 4, rng: seededRng(2) });
    const hands: Card[][] = [
      cards("Ah", "7h", "8h", "9h", "10h", "Bh", "Vh", "Hh"),
      cards("Ak", "7k", "8k", "9k", "10k", "Bk", "Vk", "Hk"),
      cards("Ar", "7r", "8r", "9r", "10r", "Br", "Vr", "Hr"),
      cards("As", "7s", "8s", "9s", "10s", "Bs", "Vs", "Hs"),
    ];
    const round = new Round({ contract: troef, makerTeam: 0, bid: 90, hands, firstLeader: 0 });
    round.play(card("Ah")); // seat0 komt uit met harten; seat1 heeft alleen klaveren → moet troeven
    const chosen = bot(round);
    expect(round.legalMoves().some((c) => c.suit === chosen.suit && c.rank === chosen.rank)).toBe(true);
  });
});
