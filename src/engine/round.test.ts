import { describe, expect, it } from "vitest";
import { Card, Contract } from "./cards";
import { deal } from "./deal";
import { Round, playRound } from "./round";
import { card, seededRng } from "./testHelpers";

const troef: Contract = { type: "kleur", troef: "klaveren" };

describe("Round — volledige ronde", () => {
  it("speelt 8 slagen, alle 32 kaarten, en de winnaar komt steeds uit", () => {
    const hands = deal(seededRng(99));
    const round = new Round({ contract: troef, makerTeam: 0, bid: 90, hands, firstLeader: 0 });

    while (!round.isComplete) {
      const before = round.tricks.length;
      round.play(round.legalMoves()[0]); // simpelste policy: eerste geldige zet
      if (round.tricks.length > before && !round.isComplete) {
        const winner = round.tricks[round.tricks.length - 1].winnerSeat;
        expect(round.currentSeat).toBe(winner);
      }
    }

    expect(round.tricks).toHaveLength(8);
    expect(round.tricks.flatMap((t) => t.plays)).toHaveLength(32);
    expect(round.tricks.filter((t) => t.isLast)).toHaveLength(1);
  });

  it("som van de kaartpunten over alle slagen is 152", () => {
    const hands = deal(seededRng(5));
    const result = (() => {
      const r = new Round({ contract: troef, makerTeam: 0, bid: 90, hands, firstLeader: 1 });
      while (!r.isComplete) r.play(r.legalMoves()[0]);
      return r;
    })();
    const sum = result.tricks.reduce((s, t) => s + t.cardPoints, 0);
    expect(sum).toBe(152);
  });

  it("eindpunten kloppen: 162 + roem als niet nat en geen pit", () => {
    const hands = deal(seededRng(12));
    const r = new Round({ contract: troef, makerTeam: 0, bid: 0, hands, firstLeader: 0 });
    while (!r.isComplete) r.play(r.legalMoves()[0]);
    const res = r.result();
    const totalRoem = r.tricks.reduce((s, t) => s + t.roem, 0);
    if (!res.nat && res.pitTeam === null) {
      expect(res.points[0] + res.points[1]).toBe(162 + totalRoem);
    }
  });
});

describe("Round — validatie", () => {
  it("weigert een kaart die niet in de hand zit", () => {
    const hands = deal(seededRng(1));
    const round = new Round({ contract: troef, makerTeam: 0, bid: 90, hands });
    const seat = round.currentSeat;
    const notInHand = (["7k", "8k", "9k", "10k", "Bk", "Vk", "Hk", "Ak", "7h"] as const)
      .map(card)
      .find((c) => !round.handOf(seat).some((h) => h.suit === c.suit && h.rank === c.rank)) as Card;
    expect(() => round.play(notInHand)).toThrow();
  });

  it("weigert 4 handen van verkeerde grootte", () => {
    expect(
      () => new Round({ contract: troef, makerTeam: 0, bid: 90, hands: [[], [], [], []] }),
    ).toThrow();
  });
});

describe("playRound — driver", () => {
  it("speelt een ronde af en geeft een geldig resultaat", () => {
    const hands = deal(seededRng(3));
    const res = playRound(
      { contract: troef, makerTeam: 0, bid: 90, hands, firstLeader: 0 },
      (round) => round.legalMoves()[0],
    );
    expect(typeof res.nat).toBe("boolean");
    expect(res.points[0]).toBeGreaterThanOrEqual(0);
    expect(res.points[1]).toBeGreaterThanOrEqual(0);
  });
});
