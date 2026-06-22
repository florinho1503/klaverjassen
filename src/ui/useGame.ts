// Game-controller: stuurt één hand klaverjassen aan (delen → bieden → spelen →
// score) met de mens op Zuid (seat 2) en bots op de andere drie plekken.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Auction,
  AuctionLogEntry,
  Bid,
  BidAction,
  Card,
  Contract,
  Difficulty,
  Play,
  Round,
  RoundResult,
  SUITS,
  Seat,
  biddingBot,
  cardBotFor,
  cardEquals,
  deal,
  explainIllegal,
  nextSeat,
  roundFromAuction,
} from "../engine";

export const HUMAN: Seat = 2;
// Bedenktijd voor de bots — bewust ~3s voor een echt spelgevoel.
const BID_DELAY_MS = 3000;
const PLAY_DELAY_MS = 3000;
const ERROR_CLEAR_MS = 2600;

export type Phase = "start" | "bieden" | "spelen" | "klaar";

export interface PlayError {
  message: string;
  card: Card;
  nonce: number;
}

export interface BidOption {
  contract: Contract;
  value: number;
}

export interface GameView {
  phase: Phase;
  difficulty: Difficulty | null;
  /** Of geldige kaarten opgelicht worden (alleen op 'makkelijk'). */
  assist: boolean;
  /** Foutmelding bij een ongeldige zet (middel/moeilijk), of null. */
  error: PlayError | null;
  dealer: Seat;
  currentSeat: Seat;
  /** Hand van de mens (Zuid). Tijdens bieden de volle hand, tijdens spelen de rest. */
  humanHand: Card[];
  /** Aantal resterende kaarten per zitplaats (voor de tegenstanderweergave). */
  handSizes: [number, number, number, number];
  /** Kaarten in het midden: de lopende slag, of de zojuist voltooide slag tijdens een pauze. */
  trick: Play[];
  /** Of we wachten tot de speler op 'Volgende slag' klikt. */
  paused: boolean;
  /** Winnaar van de getoonde (voltooide) slag, anders null. */
  trickWinnerSeat: Seat | null;
  /** Punten + roem van de zojuist voltooide slag (tijdens pauze). */
  trickPoints: number | null;
  trickRoem: number | null;
  contract: Contract | null;
  bid: number | null;
  makerSeat: Seat | null;
  highestBid: { seat: Seat; bid: Bid } | null;
  /** Verloop van het bieden (wie bood/paste wat). */
  auctionLog: AuctionLogEntry[];
  /** Biedopties voor de mens (alleen als de mens aan bod is). */
  bidOptions: BidOption[];
  canBid: boolean;
  /** Geldige kaarten voor de mens (alleen als de mens aan zet is in 'spelen'). */
  legalForHuman: Card[];
  tricksWon: [number, number];
  result: RoundResult | null;
  /** Korte statusmelding (bv. 'Iedereen paste'). */
  message: string | null;
  /** Cumulatieve score op papier over alle handen. */
  totalScore: [number, number];
}

export interface GameApi {
  view: GameView;
  begin: (difficulty: Difficulty) => void;
  humanPlay: (card: Card) => void;
  humanBid: (action: BidAction) => void;
  continueTrick: () => void;
  nextRound: () => void;
}

export function useGame(): GameApi {
  const auctionRef = useRef<Auction | null>(null);
  const roundRef = useRef<Round | null>(null);
  const handsRef = useRef<Card[][]>([]);
  const dealerRef = useRef<Seat>(3); // mens (Zuid) opent dan het bieden
  const phaseRef = useRef<Phase>("start");
  const difficultyRef = useRef<Difficulty | null>(null);
  const messageRef = useRef<string | null>(null);
  const resultRef = useRef<RoundResult | null>(null);
  const totalRef = useRef<[number, number]>([0, 0]);
  const pausedRef = useRef(false);
  const errorRef = useRef<PlayError | null>(null);
  const errorNonceRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [, setTick] = useState(0);
  const sync = useCallback(() => setTick((t) => t + 1), []);

  const buildView = useCallback((): GameView => {
    const phase = phaseRef.current;
    const auction = auctionRef.current;
    const round = roundRef.current;

    const handSizes: [number, number, number, number] = [0, 1, 2, 3].map((s) =>
      round ? round.handOf(s as Seat).length : handsRef.current[s]?.length ?? 0,
    ) as [number, number, number, number];

    const currentSeat: Seat = round
      ? round.currentSeat
      : auction && !auction.isComplete
        ? auction.currentSeat
        : HUMAN;

    const humanHand = round
      ? [...round.handOf(HUMAN)]
      : [...(handsRef.current[HUMAN] ?? [])];

    const bidOptions: BidOption[] =
      phase === "bieden" && auction && !auction.isComplete && auction.currentSeat === HUMAN
        ? [
            ...SUITS.map((suit) => {
              const contract: Contract = { type: "kleur", troef: suit };
              return { contract, value: auction.minimumFor(contract) };
            }),
            (() => {
              const contract: Contract = { type: "sans" };
              return { contract, value: auction.minimumFor(contract) };
            })(),
          ]
        : [];

    const paused = pausedRef.current;
    const difficulty = difficultyRef.current;
    const assist = difficulty === "makkelijk";

    // Geldige kaarten alleen oplichten op 'makkelijk'.
    const legalForHuman =
      assist &&
      phase === "spelen" &&
      !paused &&
      round &&
      !round.isComplete &&
      round.currentSeat === HUMAN
        ? round.legalMoves()
        : [];

    const tricksWon: [number, number] = [0, 0];
    if (round) for (const t of round.tricks) tricksWon[t.winnerTeam] += 1;

    // Wat ligt er in het midden? Normaal de lopende slag; bij pauze of na afloop
    // de zojuist voltooide slag, zodat je kunt zien wie wat oplegde.
    const lastCompleted =
      round && round.tricks.length > 0 ? round.tricks[round.tricks.length - 1] : null;
    const showCompleted = (paused || phase === "klaar") && lastCompleted !== null;

    return {
      phase,
      difficulty,
      assist,
      error: errorRef.current,
      dealer: dealerRef.current,
      currentSeat,
      humanHand,
      handSizes,
      trick: showCompleted ? [...lastCompleted!.plays] : round ? [...round.currentTrick] : [],
      paused,
      trickWinnerSeat: showCompleted ? lastCompleted!.winnerSeat : null,
      trickPoints: paused && lastCompleted ? lastCompleted.cardPoints : null,
      trickRoem: paused && lastCompleted ? lastCompleted.roem : null,
      contract: round?.contract ?? null,
      bid: round?.bid ?? null,
      makerSeat: auction?.currentHighest?.seat ?? null,
      highestBid: auction?.currentHighest ?? null,
      auctionLog: auction ? [...auction.log] : [],
      bidOptions,
      canBid: bidOptions.length > 0,
      legalForHuman,
      tricksWon,
      result: resultRef.current,
      message: messageRef.current,
      totalScore: totalRef.current,
    };
  }, []);

  const startHand = useCallback(
    (dealer: Seat) => {
      const hands = deal();
      handsRef.current = hands;
      dealerRef.current = dealer;
      auctionRef.current = new Auction({ firstBidder: nextSeat(dealer) });
      roundRef.current = null;
      resultRef.current = null;
      messageRef.current = null;
      pausedRef.current = false;
      errorRef.current = null;
      phaseRef.current = "bieden";
      sync();
    },
    [sync],
  );

  const finalizeRound = useCallback(() => {
    const round = roundRef.current!;
    const result = round.result();
    resultRef.current = result;
    totalRef.current = [
      totalRef.current[0] + result.paper[0],
      totalRef.current[1] + result.paper[1],
    ];
    phaseRef.current = "klaar";
    sync();
  }, [sync]);

  const finalizeAuction = useCallback(() => {
    const auction = auctionRef.current!;
    const result = auction.result();
    if (!result) {
      messageRef.current = "Iedereen paste — klik op 'Volgende ronde' om opnieuw te delen.";
      resultRef.current = null;
      phaseRef.current = "klaar";
      sync();
      return;
    }
    roundRef.current = roundFromAuction(result, handsRef.current, nextSeat(dealerRef.current));
    phaseRef.current = "spelen";
    sync();
  }, [sync]);

  const applyBid = useCallback(
    (action: BidAction) => {
      const auction = auctionRef.current;
      if (!auction || auction.isComplete) return;
      auction.bid(action);
      if (auction.isComplete) finalizeAuction();
      else sync();
    },
    [finalizeAuction, sync],
  );

  const applyPlay = useCallback(
    (card: Card) => {
      const round = roundRef.current;
      if (!round || round.isComplete) return;
      const tricksBefore = round.tricks.length;
      round.play(card);
      if (round.isComplete) {
        finalizeRound();
        return;
      }
      // Een slag zojuist voltooid → pauzeer tot de speler op 'Volgende slag' klikt.
      if (round.tricks.length > tricksBefore) pausedRef.current = true;
      sync();
    },
    [finalizeRound, sync],
  );

  const begin = useCallback(
    (difficulty: Difficulty) => {
      difficultyRef.current = difficulty;
      totalRef.current = [0, 0];
      dealerRef.current = 3;
      startHand(dealerRef.current);
    },
    [startHand],
  );

  // Bots laten handelen wanneer zij aan de beurt zijn.
  useEffect(() => {
    const phase = phaseRef.current;
    if (timerRef.current) clearTimeout(timerRef.current);

    if (phase === "bieden") {
      const auction = auctionRef.current;
      if (auction && !auction.isComplete && auction.currentSeat !== HUMAN) {
        const seat = auction.currentSeat;
        timerRef.current = setTimeout(() => {
          applyBid(biddingBot(auction, handsRef.current[seat]));
        }, BID_DELAY_MS);
      }
    } else if (phase === "spelen" && !pausedRef.current) {
      const round = roundRef.current;
      const difficulty = difficultyRef.current;
      if (round && difficulty && !round.isComplete && round.currentSeat !== HUMAN) {
        const bot = cardBotFor(difficulty);
        timerRef.current = setTimeout(() => {
          applyPlay(bot(round));
        }, PLAY_DELAY_MS);
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  });

  const humanPlay = useCallback(
    (card: Card) => {
      const round = roundRef.current;
      if (!round || pausedRef.current || round.currentSeat !== HUMAN) return;

      if (!round.legalMoves().some((c) => cardEquals(c, card))) {
        // Ongeldige zet → toon de reden en laat de kaart schudden.
        const reason =
          explainIllegal(
            card,
            [...round.handOf(HUMAN)],
            [...round.currentTrick],
            round.contract,
            HUMAN,
          ) ?? "Ongeldige zet.";
        errorNonceRef.current += 1;
        errorRef.current = { message: reason, card, nonce: errorNonceRef.current };
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
        errorTimerRef.current = setTimeout(() => {
          errorRef.current = null;
          sync();
        }, ERROR_CLEAR_MS);
        sync();
        return;
      }

      errorRef.current = null;
      applyPlay(card);
    },
    [applyPlay, sync],
  );

  const continueTrick = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    sync();
  }, [sync]);

  const humanBid = useCallback(
    (action: BidAction) => {
      const auction = auctionRef.current;
      if (!auction || auction.currentSeat !== HUMAN) return;
      applyBid(action);
    },
    [applyBid],
  );

  const nextRound = useCallback(() => {
    startHand(nextSeat(dealerRef.current));
  }, [startHand]);

  // Opruimen bij unmount.
  useEffect(
    () => () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    },
    [],
  );

  return { view: buildView(), begin, humanPlay, humanBid, continueTrick, nextRound };
}
