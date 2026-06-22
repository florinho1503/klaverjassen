import { describe, expect, it } from "vitest";
import { Contract, cardPoints, fullDeck, trickStrength } from "./cards";
import { card } from "./testHelpers";

const klaverenTroef: Contract = { type: "kleur", troef: "klaveren" };
const sans: Contract = { type: "sans" };

describe("cardPoints", () => {
  it("waardeert troefkaarten volgens de troeftabel", () => {
    expect(cardPoints(card("Bk"), klaverenTroef)).toBe(20);
    expect(cardPoints(card("9k"), klaverenTroef)).toBe(14);
    expect(cardPoints(card("Ak"), klaverenTroef)).toBe(11);
    expect(cardPoints(card("10k"), klaverenTroef)).toBe(10);
  });

  it("waardeert niet-troefkaarten volgens de gewone tabel", () => {
    expect(cardPoints(card("Ah"), klaverenTroef)).toBe(11);
    expect(cardPoints(card("Bh"), klaverenTroef)).toBe(2);
    expect(cardPoints(card("9h"), klaverenTroef)).toBe(0);
  });

  it("gebruikt bij sans overal de gewone waardes", () => {
    expect(cardPoints(card("Bk"), sans)).toBe(2);
    expect(cardPoints(card("9k"), sans)).toBe(0);
    expect(cardPoints(card("Ak"), sans)).toBe(11);
  });

  it("telt normaal op tot 152 kaartpunten (162 met laatste slag)", () => {
    const total = fullDeck().reduce((s, c) => s + cardPoints(c, klaverenTroef), 0);
    expect(total).toBe(152);
  });

  it("telt bij sans op tot 120 kaartpunten (130 met laatste slag)", () => {
    const total = fullDeck().reduce((s, c) => s + cardPoints(c, sans), 0);
    expect(total).toBe(120);
  });
});

describe("trickStrength", () => {
  it("laat troef de gevraagde kleur verslaan", () => {
    const troef = trickStrength(card("7k"), klaverenTroef, "harten");
    const gevraagd = trickStrength(card("Ah"), klaverenTroef, "harten");
    expect(troef).toBeGreaterThan(gevraagd);
  });

  it("rangschikt troeven als B > 9 > A > 10", () => {
    const b = trickStrength(card("Bk"), klaverenTroef, "klaveren");
    const negen = trickStrength(card("9k"), klaverenTroef, "klaveren");
    const aas = trickStrength(card("Ak"), klaverenTroef, "klaveren");
    const tien = trickStrength(card("10k"), klaverenTroef, "klaveren");
    expect(b).toBeGreaterThan(negen);
    expect(negen).toBeGreaterThan(aas);
    expect(aas).toBeGreaterThan(tien);
  });

  it("geeft kaarten buiten de gevraagde kleur (en niet-troef) kracht 0", () => {
    expect(trickStrength(card("As"), klaverenTroef, "harten")).toBe(0);
  });
});
