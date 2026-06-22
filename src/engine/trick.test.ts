import { describe, expect, it } from "vitest";
import { Contract } from "./cards";
import { Play, Seat, partnerOf, teamOf, trickWinnerSeat } from "./trick";
import { card } from "./testHelpers";

const klaverenTroef: Contract = { type: "kleur", troef: "klaveren" };
const sans: Contract = { type: "sans" };

function play(seat: number, code: string): Play {
  return { seat: seat as Seat, card: card(code) };
}

describe("teams en zitplaatsen", () => {
  it("N/Z vormen team 0, O/W team 1", () => {
    expect(teamOf(0)).toBe(0);
    expect(teamOf(2)).toBe(0);
    expect(teamOf(1)).toBe(1);
    expect(teamOf(3)).toBe(1);
  });

  it("maat zit tegenover je", () => {
    expect(partnerOf(0)).toBe(2);
    expect(partnerOf(1)).toBe(3);
  });
});

describe("trickWinnerSeat", () => {
  it("hoogste van de gevraagde kleur wint zonder troef in de slag", () => {
    const plays = [play(0, "Ah"), play(1, "10h"), play(2, "Hh"), play(3, "7h")];
    expect(trickWinnerSeat(plays, klaverenTroef)).toBe(0);
  });

  it("troef verslaat de gevraagde kleur", () => {
    const plays = [play(0, "Ah"), play(1, "7k"), play(2, "Hh"), play(3, "Vh")];
    expect(trickWinnerSeat(plays, klaverenTroef)).toBe(1);
  });

  it("hoogste troef wint als er meerdere troeven liggen", () => {
    const plays = [play(0, "Ah"), play(1, "7k"), play(2, "Bk"), play(3, "9k")];
    expect(trickWinnerSeat(plays, klaverenTroef)).toBe(2); // boer is hoogste troef
  });

  it("kaart buiten de gevraagde kleur wint niet (geen troef, sans)", () => {
    const plays = [play(0, "10h"), play(1, "As"), play(2, "Hh"), play(3, "7h")];
    expect(trickWinnerSeat(plays, sans)).toBe(0); // 10h blijft hoogste harten
  });
});
