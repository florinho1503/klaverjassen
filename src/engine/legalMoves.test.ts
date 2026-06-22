import { describe, expect, it } from "vitest";
import { Contract } from "./cards";
import { Play, Seat } from "./trick";
import { explainIllegal, legalMoves } from "./legalMoves";
import { card, cards } from "./testHelpers";

const troef: Contract = { type: "kleur", troef: "klaveren" };
const sans: Contract = { type: "sans" };

function play(seat: number, code: string): Play {
  return { seat: seat as Seat, card: card(code) };
}

/** Sorteerbare codes voor vergelijking. */
function codes(cs: { suit: string; rank: string }[]): string[] {
  const letter: Record<string, string> = {
    klaveren: "k",
    harten: "h",
    ruiten: "r",
    schoppen: "s",
  };
  return cs.map((c) => `${c.rank}${letter[c.suit]}`).sort();
}

describe("legalMoves — uitkomen", () => {
  it("mag elke kaart spelen bij een lege slag", () => {
    const hand = cards("Ah", "7k", "Vs");
    expect(legalMoves(hand, [], troef, 0)).toHaveLength(3);
  });
});

describe("legalMoves — bekennen", () => {
  it("verplicht de gevraagde kleur als je die hebt", () => {
    const hand = cards("Ah", "7h", "7k", "Vs");
    const trick = [play(0, "10h")];
    expect(codes(legalMoves(hand, trick, troef, 1))).toEqual(["7h", "Ah"]);
  });

  it("sans: bekennen verplicht, anders vrij", () => {
    const trick = [play(0, "10h")];
    expect(codes(legalMoves(cards("Ah", "Ks", "7k"), trick, sans, 1))).toEqual(["Ah"]);
    expect(legalMoves(cards("As", "7k"), trick, sans, 1)).toHaveLength(2);
  });
});

describe("legalMoves — troef gevraagd", () => {
  it("verplicht te overtroeven als dat kan", () => {
    const hand = cards("Bk", "7k", "Ah"); // boer is hoger dan de gespeelde 9k
    const trick = [play(0, "9k")];
    expect(codes(legalMoves(hand, trick, troef, 1))).toEqual(["Bk"]);
  });

  it("verplicht een troef bij te leggen als je niet kunt overtroeven", () => {
    const hand = cards("10k", "7k", "Ah"); // boer ligt al; niets hoger
    const trick = [play(0, "Bk")];
    expect(codes(legalMoves(hand, trick, troef, 1))).toEqual(["10k", "7k"].sort());
  });

  it("mag alles als je geen troef hebt", () => {
    const hand = cards("Ah", "Vs", "10r");
    const trick = [play(0, "9k")];
    expect(legalMoves(hand, trick, troef, 1)).toHaveLength(3);
  });
});

describe("legalMoves — Amsterdams: niet kunnen bekennen", () => {
  it("maatslag: maat wint → niet verplicht te troeven (vrij)", () => {
    const hand = cards("7k", "Vs", "10r"); // heeft troef, maar hoeft niet
    const trick = [play(0, "Ah"), play(1, "7h")]; // seat0 (maat van seat2) wint
    expect(legalMoves(hand, trick, troef, 2)).toHaveLength(3);
  });

  it("tegenstander wint met niet-troef → introeven verplicht", () => {
    const hand = cards("7k", "Bk", "Vs"); // moet troeven
    const trick = [play(0, "Ah")]; // seat0 is tegenstander van seat1
    expect(codes(legalMoves(hand, trick, troef, 1))).toEqual(["7k", "Bk"].sort());
  });

  it("tegenstander wint met troef → overtroeven verplicht", () => {
    const hand = cards("Bk", "7k", "Vs");
    const trick = [play(0, "Ah"), play(1, "9k")]; // seat1 (tegenstander van seat2) wint met troef
    expect(codes(legalMoves(hand, trick, troef, 2))).toEqual(["Bk"]); // alleen hoger dan 9k
  });

  it("tegenstander wint met troef, niet kunnen overtroeven → ondertroeven (aanname)", () => {
    const hand = cards("10k", "7k", "Vs");
    const trick = [play(0, "Ah"), play(1, "Bk")]; // boer is hoogste, niets hoger
    expect(codes(legalMoves(hand, trick, troef, 2))).toEqual(["10k", "7k"].sort());
  });

  it("tegenstander wint maar je hebt geen troef → vrij", () => {
    const hand = cards("Vs", "10r", "As");
    const trick = [play(0, "Ah")];
    expect(legalMoves(hand, trick, troef, 1)).toHaveLength(3);
  });

  it("troef gevraagd, maat wint met troef → wel troef volgen, niet verplicht over je maat", () => {
    const hand = cards("Bk", "7k", "Ah"); // boer zou kunnen overtroeven, maar hoeft niet
    const trick = [play(0, "9k")]; // seat0 = maat van seat2, wint met troef
    expect(codes(legalMoves(hand, trick, troef, 2))).toEqual(["7k", "Bk"].sort());
  });
});

describe("explainIllegal", () => {
  it("geeft null voor een geldige zet", () => {
    const hand = cards("Ah", "7h", "7k");
    const trick = [play(0, "10h")];
    expect(explainIllegal(card("Ah"), hand, trick, troef, 1)).toBeNull();
  });

  it("legt uit dat je moet bekennen", () => {
    const hand = cards("Ah", "7h", "Vs");
    const trick = [play(0, "10h")];
    expect(explainIllegal(card("Vs"), hand, trick, troef, 1)).toMatch(/bekennen \(harten\)/);
  });

  it("legt uit dat je troef moet bijspelen als troef gevraagd is", () => {
    const hand = cards("7k", "Ah", "Vs");
    const trick = [play(0, "9k")];
    expect(explainIllegal(card("Ah"), hand, trick, troef, 1)).toMatch(/troef/);
  });

  it("legt uit dat je moet introeven als de tegenstander wint", () => {
    const hand = cards("7k", "Vs", "10r");
    const trick = [play(0, "Ah")]; // tegenstander wint, geen troef
    expect(explainIllegal(card("Vs"), hand, trick, troef, 1)).toMatch(/introeven/);
  });

  it("legt uit dat je moet overtroeven", () => {
    const hand = cards("Bk", "7k", "Vs");
    const trick = [play(0, "Ah"), play(1, "9k")]; // seat1 tegenstander van seat2 wint met troef
    expect(explainIllegal(card("7k"), hand, trick, troef, 2)).toMatch(/overtroeven/);
  });
});
