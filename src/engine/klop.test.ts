import { describe, expect, it } from "vitest";
import { Contract } from "./cards";
import { TrickResult } from "./scoring";
import { scoreWithKlop } from "./klop";

const troef: Contract = { type: "kleur", troef: "klaveren" };

// 8 slagen: team 0 (klopteam) wint slag 0 met 20 roem, team 1 de rest.
function tricks(roemTrick0 = 20): TrickResult[] {
  const ts: TrickResult[] = [
    { winnerTeam: 0, cardPoints: 50, roem: roemTrick0 },
    { winnerTeam: 1, cardPoints: 102, roem: 0 },
  ];
  for (let i = 0; i < 5; i++) ts.push({ winnerTeam: 1, cardPoints: 0, roem: 0 });
  ts.push({ winnerTeam: 1, cardPoints: 0, roem: 0, isLast: true });
  return ts;
}

describe("scoreWithKlop", () => {
  it("geklopte roem telt mee voor het klopteam", () => {
    const r = scoreWithKlop({
      contract: troef, bid: 60, makerTeam: 0, tricks: tricks(20),
      klopTeam: 0, klopped: new Set([0]), strict: true,
    });
    // team 0: 50 kaart + 20 roem = 70 (gehaald, bod 60)
    expect(r.nat).toBe(false);
    expect(r.points[0]).toBe(70);
  });

  it("niet-geklopte roem van het klopteam vervalt", () => {
    const r = scoreWithKlop({
      contract: troef, bid: 60, makerTeam: 0, tricks: tricks(20),
      klopTeam: 0, klopped: new Set(), strict: true,
    });
    // roem vervalt → team 0 heeft 50 < 60 → nat
    expect(r.nat).toBe(true);
  });

  it("foute klop (geklopt zonder roem) straft de tegenstander in strenge modus", () => {
    const t: TrickResult[] = tricks(20);
    t[7] = { winnerTeam: 0, cardPoints: 0, roem: 0, isLast: true }; // team0 wint laatste, geen roem
    const zonderFoute = scoreWithKlop({
      contract: troef, bid: 60, makerTeam: 0, tricks: t,
      klopTeam: 0, klopped: new Set([0]), strict: true,
    });
    const metFoute = scoreWithKlop({
      contract: troef, bid: 60, makerTeam: 0, tricks: t,
      klopTeam: 0, klopped: new Set([0, 7]), strict: true, // slag 7 ten onrechte geklopt
    });
    expect(metFoute.points[1]).toBe(zonderFoute.points[1] + 20);
  });

  it("zachte modus: foute klop geeft geen straf", () => {
    const tricksFoute: TrickResult[] = tricks(20);
    tricksFoute[7] = { winnerTeam: 0, cardPoints: 0, roem: 0, isLast: true };
    const strict = scoreWithKlop({
      contract: troef, bid: 60, makerTeam: 0, tricks: tricksFoute,
      klopTeam: 0, klopped: new Set([0, 7]), strict: true,
    });
    const soft = scoreWithKlop({
      contract: troef, bid: 60, makerTeam: 0, tricks: tricksFoute,
      klopTeam: 0, klopped: new Set([0, 7]), strict: false,
    });
    expect(strict.points[1]).toBe(soft.points[1] + 20);
  });
});
