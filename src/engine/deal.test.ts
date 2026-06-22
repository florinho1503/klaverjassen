import { describe, expect, it } from "vitest";
import { cardToString } from "./cards";
import { deal, shuffle } from "./deal";
import { fullDeck } from "./cards";
import { seededRng } from "./testHelpers";

describe("deal", () => {
  it("deelt 4 handen van 8 kaarten", () => {
    const hands = deal(seededRng(1));
    expect(hands).toHaveLength(4);
    for (const h of hands) expect(h).toHaveLength(8);
  });

  it("deelt alle 32 kaarten precies één keer uit", () => {
    const hands = deal(seededRng(42));
    const all = hands.flat().map(cardToString).sort();
    expect(all).toHaveLength(32);
    expect(new Set(all).size).toBe(32);
  });

  it("is deterministisch bij dezelfde seed", () => {
    const a = deal(seededRng(7)).flat().map(cardToString);
    const b = deal(seededRng(7)).flat().map(cardToString);
    expect(a).toEqual(b);
  });
});

describe("shuffle", () => {
  it("behoudt alle kaarten", () => {
    const shuffled = shuffle(fullDeck(), seededRng(3));
    expect(shuffled).toHaveLength(32);
    expect(new Set(shuffled.map(cardToString)).size).toBe(32);
  });
});
