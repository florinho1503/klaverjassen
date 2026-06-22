import { describe, expect, it } from "vitest";
import { Card, Contract } from "./cards";
import { deal } from "./deal";
import { Round, playRound } from "./round";
import { mediumBot } from "./mediumBot";
import { card, cards, seededRng } from "./testHelpers";

const troef: Contract = { type: "kleur", troef: "klaveren" };

describe("mediumBot — keuzes", () => {
  it("maker met sterke troef trekt troef (speelt de hoogste troef uit)", () => {
    const hands: Card[][] = [
      cards("Bk", "9k", "Ak", "10k", "7h", "8h", "7r", "8r"), // 4 troeven incl. Jas
      cards("7k", "8k", "Hk", "Vk", "9h", "10h", "Bh", "Vh"),
      cards("Hh", "Ah", "9r", "10r", "Br", "Vr", "Hr", "Ar"),
      cards("7s", "8s", "9s", "10s", "Bs", "Vs", "Hs", "As"),
    ];
    const round = new Round({ contract: troef, makerTeam: 0, bid: 100, hands, firstLeader: 0 });
    expect(mediumBot(round)).toEqual(card("Bk"));
  });

  it("casht een baas-aas bij uitkomen als hij geen troef hoeft te trekken", () => {
    const hands: Card[][] = [
      cards("Ah", "7h", "8h", "9h", "10h", "Bh", "Vh", "Hh"), // alle harten, incl. aas
      cards("Ak", "7k", "8k", "9k", "10k", "Bk", "Vk", "Hk"),
      cards("Ar", "7r", "8r", "9r", "10r", "Br", "Vr", "Hr"),
      cards("As", "7s", "8s", "9s", "10s", "Bs", "Vs", "Hs"),
    ];
    // makerTeam = 1, dus seat0 is geen maker → geen troef trekken.
    const round = new Round({ contract: troef, makerTeam: 1, bid: 90, hands, firstLeader: 0 });
    expect(mediumBot(round)).toEqual(card("Ah"));
  });

  it("geeft punten mee aan de maat als die de slag veilig wint (laatste man)", () => {
    const hands: Card[][] = [
      cards("7h", "8h", "9h", "10h", "7r", "8r", "9r", "10r"),
      cards("Bk", "9k", "Ak", "10k", "7k", "8k", "Hk", "Vk"), // maat van seat3
      cards("Ah", "Bh", "Vh", "Hh", "Ar", "Br", "Vr", "Hr"),
      cards("7s", "8s", "9s", "10s", "Bs", "Vs", "Hs", "As"), // mens-positie hier niet relevant
    ];
    const round = new Round({ contract: troef, makerTeam: 0, bid: 90, hands, firstLeader: 0 });
    round.play(card("7h")); // seat0 komt uit met harten
    round.play(card("Bk")); // seat1 (maat van seat3) troeft met de Jas → onverslaanbaar
    round.play(card("Hh")); // seat2 bekent harten
    // seat3 is aan zet, kan harten niet bekennen, maat wint → punten meegeven
    expect(mediumBot(round)).toEqual(card("As")); // schoppen-aas = 11 punten voor ons
  });
});

describe("mediumBot — volledige rondes", () => {
  it("speelt elke ronde legaal uit (meerdere seeds + sans)", () => {
    for (const seed of [1, 2, 3, 17, 99, 256, 777]) {
      const res = playRound(
        { contract: troef, makerTeam: 0, bid: 90, hands: deal(seededRng(seed)), firstLeader: 0 },
        mediumBot,
      );
      expect(typeof res.nat).toBe("boolean");
    }
    const sans = playRound(
      { contract: { type: "sans" }, makerTeam: 1, bid: 80, hands: deal(seededRng(42)), firstLeader: 1 },
      mediumBot,
    );
    expect(typeof sans.nat).toBe("boolean");
  });
});
