import { describe, expect, it } from "vitest";
import { Contract } from "./cards";
import { deal } from "./deal";
import { heuristicBot } from "./bot";
import {
  Auction,
  Bid,
  biddingBot,
  evaluateBid,
  roundFromAuction,
  runAuction,
} from "./bidding";
import { Seat } from "./trick";
import { cards, seededRng } from "./testHelpers";

const klaveren: Contract = { type: "kleur", troef: "klaveren" };

function bidKlaveren(value: number): Bid {
  return { value, contract: klaveren };
}

describe("Auction — verloop", () => {
  it("één bod, rest past → die speler is maker", () => {
    const a = new Auction({ firstBidder: 0 });
    a.bid(bidKlaveren(80)); // seat 0
    a.bid("pas"); // 1
    a.bid("pas"); // 2
    a.bid("pas"); // 3
    expect(a.isComplete).toBe(true);
    const r = a.result()!;
    expect(r.makerSeat).toBe(0);
    expect(r.makerTeam).toBe(0);
    expect(r.bid.value).toBe(80);
  });

  it("hoger bieden: hoogste bod wint, stopt na 3 passen op rij", () => {
    const a = new Auction({ firstBidder: 0 });
    a.bid(bidKlaveren(80)); // 0
    a.bid(bidKlaveren(90)); // 1
    a.bid("pas"); // 2
    a.bid(bidKlaveren(100)); // 3 → reset passen
    a.bid("pas"); // 0
    a.bid("pas"); // 1
    a.bid("pas"); // 2 → 3 passen op rij na het laatste bod
    expect(a.isComplete).toBe(true);
    expect(a.result()!.makerSeat).toBe(3);
    expect(a.result()!.bid.value).toBe(100);
  });

  it("wie paste mag er later tóch weer overheen bieden", () => {
    const a = new Auction({ firstBidder: 0 });
    a.bid("pas"); // 0 past
    a.bid(bidKlaveren(80)); // 1 biedt
    a.bid("pas"); // 2
    a.bid("pas"); // 3
    // terug bij seat 0, die eerder paste — moet nu tóch mogen bieden
    expect(a.currentSeat).toBe(0);
    expect(a.isComplete).toBe(false);
    a.bid(bidKlaveren(90)); // 0 biedt alsnog over de 80 heen
    expect(a.currentHighest!.seat).toBe(0);
    a.bid("pas"); // 1
    a.bid("pas"); // 2
    a.bid("pas"); // 3 → 3 passen op rij
    expect(a.isComplete).toBe(true);
    expect(a.result()!.makerSeat).toBe(0);
    expect(a.result()!.bid.value).toBe(90);
  });

  it("iedereen past → geen maker", () => {
    const a = new Auction({ firstBidder: 0 });
    a.bid("pas");
    a.bid("pas");
    a.bid("pas");
    a.bid("pas");
    expect(a.isComplete).toBe(true);
    expect(a.result()).toBeNull();
  });

  it("weigert een bod onder het minimum of geen veelvoud van 10", () => {
    const a = new Auction({ firstBidder: 0 });
    expect(a.isLegal(bidKlaveren(70))).toBe(false); // kleur min = 80
    expect(a.isLegal(bidKlaveren(85))).toBe(false); // geen veelvoud van 10
    expect(a.isLegal({ value: 70, contract: { type: "sans" } })).toBe(true); // sans min = 70
  });

  it("een volgend bod moet hoger zijn dan het lopende bod", () => {
    const a = new Auction({ firstBidder: 0 });
    a.bid(bidKlaveren(90));
    expect(a.minimumFor(klaveren)).toBe(100);
    expect(a.isLegal(bidKlaveren(90))).toBe(false);
  });
});

describe("evaluateBid — handwaardering", () => {
  it("B & 9 + 2 azen → kleur 110", () => {
    const hand = cards("Bk", "9k", "As", "Ah", "7r", "8r", "Vs", "Hs");
    const bid = evaluateBid(hand)!;
    expect(bid.contract).toEqual(klaveren);
    expect(bid.value).toBe(110);
  });

  it("alleen een 9 (geen boer) → 80", () => {
    const hand = cards("9r", "7k", "8h", "Vr", "Hs", "8s", "7s", "Vh");
    const bid = evaluateBid(hand)!;
    expect(bid.value).toBe(80);
  });

  it("zwakke hand zonder boer/negen en weinig A/10 → passen", () => {
    const hand = cards("7k", "8h", "Vr", "Hs", "8s", "7s", "10r", "Vh");
    expect(evaluateBid(hand)).toBeNull();
  });

  it("veel azen en tienen, geen B&9-kleur → sans", () => {
    const hand = cards("Ak", "Ah", "Ar", "As", "10k", "10h", "7r", "8s");
    const bid = evaluateBid(hand)!;
    expect(bid.contract).toEqual({ type: "sans" });
    expect(bid.value).toBe(100);
  });

  it("biedt conservatief sans: 2 azen is niet genoeg voor 90 sans", () => {
    // 2 azen, geen B/9 (dus geen kleurbod), geen gedekte tienen → te zwak voor sans
    const hand = cards("Ah", "Ar", "7k", "8k", "7s", "8s", "7r", "Hr");
    expect(evaluateBid(hand)).toBeNull();
  });

  it("3 azen → 80 sans (niet 90)", () => {
    const hand = cards("Ah", "Ar", "As", "7k", "8k", "7s", "8h", "7r");
    const bid = evaluateBid(hand)!;
    expect(bid.contract).toEqual({ type: "sans" });
    expect(bid.value).toBe(80);
  });

  it("4 azen → pas dan 90 sans", () => {
    const hand = cards("Ah", "Ar", "As", "Ak", "7s", "8s", "7h", "8h");
    const bid = evaluateBid(hand)!;
    expect(bid.contract).toEqual({ type: "sans" });
    expect(bid.value).toBe(90);
  });
});

describe("biddingBot + runAuction", () => {
  it("bot opent minimaal (80) ook met een sterke hand", () => {
    const a = new Auction({ firstBidder: 0 });
    const hand = cards("Bk", "9k", "As", "Ah", "7r", "8r", "Vs", "Hs"); // waard 110
    const action = biddingBot(a, hand);
    expect(action).not.toBe("pas");
    expect((action as Bid).value).toBe(80);
  });

  it("integratie: delen → bieden → ronde spelen", () => {
    const hands = deal(seededRng(123));
    const firstBidder: Seat = 0;
    const result = runAuction({ firstBidder }, hands);
    if (result) {
      const round = roundFromAuction(result, hands, firstBidder);
      while (!round.isComplete) round.play(heuristicBot(round));
      expect(round.tricks).toHaveLength(8);
      expect(typeof round.result().nat).toBe("boolean");
    } else {
      expect(result).toBeNull(); // geldige uitkomst: iedereen paste
    }
  });
});
