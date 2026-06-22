import { describe, expect, it } from "vitest";
import { Contract } from "./cards";
import { Team } from "./trick";
import { RoundInput, TrickResult, scoreRound, toPaper } from "./scoring";

const troef: Contract = { type: "kleur", troef: "klaveren" };

/** Bouw 8 slagen waarvan team `maker` `makerCard` kaartpunten haalt (rest tegenpartij). */
function tricksSplit(makerCard: number, maker: Team, makerRoem = 0, defRoem = 0): TrickResult[] {
  const defender: Team = maker === 0 ? 1 : 0;
  const ts: TrickResult[] = [];
  // 7 gewone slagen verdeeld, 1 laatste slag.
  ts.push({ winnerTeam: maker, cardPoints: makerCard, roem: makerRoem });
  ts.push({ winnerTeam: defender, cardPoints: 152 - makerCard, roem: defRoem });
  for (let i = 0; i < 5; i++) ts.push({ winnerTeam: maker, cardPoints: 0, roem: 0 });
  ts.push({ winnerTeam: maker, cardPoints: 0, roem: 0, isLast: true });
  return ts;
}

describe("toPaper — afronding met drempel 7", () => {
  it("86 → 8, 87 → 9", () => {
    expect(toPaper(86)).toBe(8);
    expect(toPaper(87)).toBe(9);
  });
  it("162 → 16, 130 → 13", () => {
    expect(toPaper(162)).toBe(16);
    expect(toPaper(130)).toBe(13);
  });
  it("80 → 8, 89 → 9", () => {
    expect(toPaper(80)).toBe(8);
    expect(toPaper(89)).toBe(9);
  });
});

describe("scoreRound — nat / gehaald", () => {
  it("maker haalt het bod → ieder houdt eigen punten", () => {
    const input: RoundInput = { contract: troef, bid: 90, makerTeam: 0, tricks: tricksSplit(100, 0) };
    const r = scoreRound(input);
    expect(r.nat).toBe(false);
    // maker: 100 kaart + 10 laatste slag = 110; tegenpartij: 52
    expect(r.points[0]).toBe(110);
    expect(r.points[1]).toBe(52);
  });

  it("maker haalt bod niet → nat, alles naar tegenpartij", () => {
    const input: RoundInput = { contract: troef, bid: 100, makerTeam: 0, tricks: tricksSplit(60, 0) };
    const r = scoreRound(input);
    expect(r.nat).toBe(true);
    expect(r.points[0]).toBe(0);
    expect(r.points[1]).toBe(162); // volledige 162 naar tegenpartij
  });

  it("roem telt mee voor het halen van het bod", () => {
    // 75 kaart + 10 laatste + 20 roem = 105 ≥ bod 100 → gehaald
    const input: RoundInput = { contract: troef, bid: 100, makerTeam: 0, tricks: tricksSplit(75, 0, 20) };
    const r = scoreRound(input);
    expect(r.makerPoints).toBe(105);
    expect(r.nat).toBe(false);
  });

  it("bij nat gaan ook de roempunten naar de tegenpartij", () => {
    const input: RoundInput = { contract: troef, bid: 120, makerTeam: 0, tricks: tricksSplit(60, 0, 20, 20) };
    const r = scoreRound(input);
    expect(r.nat).toBe(true);
    expect(r.points[1]).toBe(162 + 40); // alle kaart + alle roem
  });
});

describe("scoreRound — pit", () => {
  it("alle 8 slagen voor maker → +100 bonus", () => {
    const ts: TrickResult[] = [];
    for (let i = 0; i < 7; i++) ts.push({ winnerTeam: 0, cardPoints: i === 0 ? 152 : 0, roem: 0 });
    ts.push({ winnerTeam: 0, cardPoints: 0, roem: 0, isLast: true });
    const r = scoreRound({ contract: troef, bid: 100, makerTeam: 0, tricks: ts });
    expect(r.pitTeam).toBe(0);
    expect(r.points[0]).toBe(162 + 100);
    expect(r.points[1]).toBe(0);
  });
});
