import { describe, expect, it } from "vitest";
import { Contract } from "./cards";
import { roemInTrick } from "./roem";
import { cards } from "./testHelpers";

const troef: Contract = { type: "kleur", troef: "klaveren" };
const sans: Contract = { type: "sans" };

describe("roemInTrick", () => {
  it("geen roem", () => {
    expect(roemInTrick(cards("Ah", "7k", "Vs", "10r"), troef)).toBe(0);
  });

  it("3 op een rij = 20", () => {
    expect(roemInTrick(cards("7h", "8h", "9h", "Vs"), troef)).toBe(20);
  });

  it("4 op een rij = 50", () => {
    expect(roemInTrick(cards("7h", "8h", "9h", "10h"), troef)).toBe(50);
  });

  it("stuk (H+V troef) = 20", () => {
    expect(roemInTrick(cards("Hk", "Vk", "Ah", "7s"), troef)).toBe(20);
  });

  it("3 op een rij in troef met stuk = 40 (20 loop + 20 stuk)", () => {
    // V-H-A klaveren: loop van 3 (20) + stuk H+V (20)
    expect(roemInTrick(cards("Vk", "Hk", "Ak", "7s"), troef)).toBe(40);
  });

  it("4 op een rij met stuk = 70", () => {
    // 10-B-V-H klaveren: loop van 4 (50) + stuk (20)
    expect(roemInTrick(cards("10k", "Bk", "Vk", "Hk"), troef)).toBe(70);
  });

  it("geen stuk bij sans (geen troef)", () => {
    expect(roemInTrick(cards("Hk", "Vk", "Ah", "7s"), sans)).toBe(0);
  });

  it("een reeks telt ook bij sans", () => {
    expect(roemInTrick(cards("7h", "8h", "9h", "Vs"), sans)).toBe(20);
  });
});
