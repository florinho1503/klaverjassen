import { useEffect, useState } from "react";
import { BidAction, Card, Contract, Seat, cardEquals } from "./engine";
import { AuctionLogEntry } from "./engine";
import { CardBack, CardView } from "./ui/CardView";
import {
  SEAT_NAME,
  SUIT_SYMBOL,
  contractLabel,
  contractShort,
  isRed,
} from "./ui/display";
import { BidOption, GameView, HUMAN, useGame } from "./ui/useGame";
import "./App.css";

export function App() {
  const { view, humanPlay, humanBid, continueTrick, nextRound } = useGame();

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__left">
          <h1>Klaverjassen oefenen</h1>
          <CardValuesHint />
        </div>
        <TroefIndicator view={view} />
        <ScoreBoard view={view} />
      </header>

      <div className="table">
        <Opponent seat={0} view={view} position="top" />
        <Opponent seat={3} view={view} position="left" />
        <Opponent seat={1} view={view} position="right" />

        <div className="center">
          <TrickView view={view} />
        </div>

        <div className="south">
          <SeatLabel seat={HUMAN} view={view} />
          <HumanHand view={view} onPlay={humanPlay} />
        </div>
      </div>

      <Panel view={view} onBid={humanBid} onNext={nextRound} onContinue={continueTrick} />
    </div>
  );
}

const TROEF_VALUES: [string, number][] = [
  ["B", 20],
  ["9", 14],
  ["A", 11],
  ["10", 10],
  ["H", 4],
  ["V", 3],
  ["8", 0],
  ["7", 0],
];
const PLAIN_VALUES: [string, number][] = [
  ["A", 11],
  ["10", 10],
  ["H", 4],
  ["V", 3],
  ["B", 2],
  ["9", 0],
  ["8", 0],
  ["7", 0],
];

function ValuesTable({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <table className="hint__table">
      <caption>{title}</caption>
      <tbody>
        {rows.map(([rank, value]) => (
          <tr key={rank}>
            <td className="hint__rank">{rank}</td>
            <td className="hint__val">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CardValuesHint() {
  const [open, setOpen] = useState(false);
  return (
    <div className="hint">
      <button
        type="button"
        className="hint__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        💡 Kaartwaardes {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="hint__panel">
          <ValuesTable title="Troef" rows={TROEF_VALUES} />
          <ValuesTable title="Niet-troef" rows={PLAIN_VALUES} />
        </div>
      )}
    </div>
  );
}

function TroefIndicator({ view }: { view: GameView }) {
  const contract = view.contract;
  if (!contract) {
    return (
      <div className="troef troef--none">
        <span className="troef__label">Troef</span>
        <span className="troef__value">— (nog bieden)</span>
      </div>
    );
  }
  const red = contract.type === "kleur" && isRed(contract.troef);
  return (
    <div className="troef">
      <span className="troef__label">Troef</span>
      <span className={`troef__value ${red ? "red" : ""}`}>
        {contract.type === "sans"
          ? "Sans (zonder troef)"
          : `${SUIT_SYMBOL[contract.troef]} ${contractLabel(contract)}`}
      </span>
    </div>
  );
}

function ScoreBoard({ view }: { view: GameView }) {
  return (
    <div className="scoreboard">
      <div className="scoreboard__team">
        <span>Wij (N/Z)</span>
        <strong>{view.totalScore[0]}</strong>
      </div>
      <div className="scoreboard__team">
        <span>Zij (O/W)</span>
        <strong>{view.totalScore[1]}</strong>
      </div>
    </div>
  );
}

function lastActionFor(view: GameView, seat: Seat): BidAction | undefined {
  if (view.phase !== "bieden") return undefined;
  for (let i = view.auctionLog.length - 1; i >= 0; i--) {
    if (view.auctionLog[i].seat === seat) return view.auctionLog[i].action;
  }
  return undefined;
}

function SeatLabel({ seat, view }: { seat: Seat; view: GameView }) {
  const active = view.currentSeat === seat && view.phase !== "klaar";
  const isDealer = view.dealer === seat;
  const isMaker = view.makerSeat === seat && view.phase !== "bieden";
  const lastAction = lastActionFor(view, seat);
  return (
    <div className={`seatlabel ${active ? "seatlabel--active" : ""}`}>
      {SEAT_NAME[seat]}
      {isDealer && <span className="badge">deler</span>}
      {isMaker && <span className="badge badge--maker">speler</span>}
      {lastAction && (
        <span
          className={`seatlabel__bid ${lastAction === "pas" ? "seatlabel__bid--pass" : ""}`}
        >
          {bidActionLabel(lastAction)}
        </span>
      )}
    </div>
  );
}

function Opponent({
  seat,
  view,
  position,
}: {
  seat: Seat;
  view: GameView;
  position: "top" | "left" | "right";
}) {
  const count = view.handSizes[seat];
  return (
    <div className={`opponent opponent--${position}`}>
      <SeatLabel seat={seat} view={view} />
      <div className={`opponent__cards opponent__cards--${position}`}>
        {Array.from({ length: count }).map((_, i) => (
          <CardBack key={i} />
        ))}
      </div>
    </div>
  );
}

function TrickView({ view }: { view: GameView }) {
  const slots: Record<Seat, Card | null> = { 0: null, 1: null, 2: null, 3: null };
  for (const p of view.trick) slots[p.seat] = p.card;
  const pos: Record<Seat, string> = { 0: "trick--top", 1: "trick--right", 2: "trick--bottom", 3: "trick--left" };

  return (
    <div className="trick">
      {([0, 1, 2, 3] as Seat[]).map((seat) => (
        <div
          key={seat}
          className={`trick__slot ${pos[seat]} ${
            view.trickWinnerSeat === seat ? "trick__slot--winner" : ""
          }`}
        >
          {slots[seat] ? <CardView card={slots[seat]!} /> : <div className="trick__empty" />}
        </div>
      ))}
      {view.contract && (
        <div className="trick__contract">
          <span className={isContractRed(view) ? "red" : ""}>{contractShort(view.contract)}</span>
        </div>
      )}
    </div>
  );
}

function isContractRed(view: GameView): boolean {
  return view.contract?.type === "kleur" && isRed(view.contract.troef);
}

function HumanHand({ view, onPlay }: { view: GameView; onPlay: (c: Card) => void }) {
  const sorted = sortHand(view.humanHand);
  const canPlay = view.phase === "spelen" && view.currentSeat === HUMAN;
  const isLegal = (c: Card) => view.legalForHuman.some((l) => cardEquals(l, c));

  return (
    <div className="hand">
      {sorted.map((card) => {
        const playable = canPlay && isLegal(card);
        return (
          <CardView
            key={`${card.suit}-${card.rank}`}
            card={card}
            playable={playable}
            dimmed={canPlay && !playable}
            onClick={playable ? () => onPlay(card) : undefined}
          />
        );
      })}
    </div>
  );
}

function bidActionLabel(action: BidAction): string {
  if (action === "pas") return "Pas";
  return `${action.value} ${
    action.contract.type === "sans" ? "Sans" : SUIT_SYMBOL[action.contract.troef]
  }`;
}

function BidLog({ entries }: { entries: AuctionLogEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="bidlog">
      {entries.map((e, i) => (
        <div key={i} className="bidlog__row">
          <span className="bidlog__seat">{SEAT_NAME[e.seat]}</span>
          <span
            className={`bidlog__action ${e.action === "pas" ? "bidlog__action--pass" : ""}`}
          >
            {bidActionLabel(e.action)}
          </span>
        </div>
      ))}
    </div>
  );
}

function PlayBanner({
  makerSeat,
  bid,
  contract,
}: {
  makerSeat: Seat | null;
  bid: number | null;
  contract: Contract | null;
}) {
  if (makerSeat === null || bid === null || !contract) return null;
  const wij = makerSeat % 2 === 0;
  return (
    <div className="playbanner">
      <strong>{SEAT_NAME[makerSeat]}</strong> speelt{" "}
      <strong>
        {bid} {contractLabel(contract)}
      </strong>{" "}
      <span className={`playbanner__team ${wij ? "wij" : "zij"}`}>
        ({wij ? "jullie team" : "tegenpartij"})
      </span>
    </div>
  );
}

function optionKey(contract: Contract): string {
  return contract.type === "sans" ? "sans" : contract.troef;
}

function contractSymbol(contract: Contract): string {
  return contract.type === "sans" ? "Sans" : SUIT_SYMBOL[contract.troef];
}

function BiddingControls({
  options,
  onBid,
}: {
  options: BidOption[];
  onBid: (a: BidAction) => void;
}) {
  const [key, setKey] = useState<string>(optionKey(options[0].contract));
  const selected = options.find((o) => optionKey(o.contract) === key) ?? options[0];
  const min = selected.value;
  const max = selected.contract.type === "sans" ? 130 : 160;

  const [value, setValue] = useState(min);

  // Klem het bod als het minimum verandert (ander contract of nieuwe biedbeurt).
  useEffect(() => {
    setValue((v) => (v < min ? min : v > max ? max : v));
  }, [min, max]);

  return (
    <div className="bidcontrols">
      <div className="bidcontrols__contracts">
        {options.map((o) => {
          const k = optionKey(o.contract);
          return (
            <button
              key={k}
              type="button"
              className={`btn btn--contract ${k === key ? "btn--sel" : ""}`}
              onClick={() => setKey(k)}
            >
              {contractSymbol(o.contract)}
              <small>min {o.value}</small>
            </button>
          );
        })}
      </div>

      <div className="bidcontrols__stepper">
        <button
          type="button"
          className="btn btn--step"
          onClick={() => setValue((v) => Math.max(min, v - 10))}
          disabled={value <= min}
          aria-label="Bod verlagen"
        >
          ▼
        </button>
        <span className="bidcontrols__value">{value}</span>
        <button
          type="button"
          className="btn btn--step"
          onClick={() => setValue((v) => Math.min(max, v + 10))}
          disabled={value >= max}
          aria-label="Bod verhogen"
        >
          ▲
        </button>
      </div>

      <div className="bidcontrols__actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => onBid({ value, contract: selected.contract })}
        >
          Bied {value} {contractSymbol(selected.contract)}
        </button>
        <button type="button" className="btn btn--pass" onClick={() => onBid("pas")}>
          Pas
        </button>
      </div>
    </div>
  );
}

function Panel({
  view,
  onBid,
  onNext,
  onContinue,
}: {
  view: GameView;
  onBid: (a: BidAction) => void;
  onNext: () => void;
  onContinue: () => void;
}) {
  if (view.phase === "klaar") {
    return (
      <div className="panel">
        <RoundSummary view={view} />
        <button className="btn btn--primary" onClick={onNext}>
          Volgende ronde
        </button>
      </div>
    );
  }

  if (view.phase === "bieden") {
    return (
      <div className="panel">
        <div className="panel__info">
          <strong>Bieden.</strong>{" "}
          {view.highestBid ? (
            <>
              Hoogste bod: {view.highestBid.bid.value} {contractLabel(view.highestBid.bid.contract)} (
              {SEAT_NAME[view.highestBid.seat]}).
            </>
          ) : (
            <>Nog geen bod.</>
          )}{" "}
          {view.currentSeat === HUMAN ? "Jij bent aan bod." : `${SEAT_NAME[view.currentSeat]} denkt na…`}
        </div>
        <BidLog entries={view.auctionLog} />
        {view.canBid && <BiddingControls options={view.bidOptions} onBid={onBid} />}
      </div>
    );
  }

  // spelen — pauze tussen slagen
  if (view.paused && view.trickWinnerSeat !== null) {
    const wij = view.trickWinnerSeat % 2 === 0;
    return (
      <div className="panel">
        <PlayBanner makerSeat={view.makerSeat} bid={view.bid} contract={view.contract} />
        <div className="panel__info">
          <strong>{SEAT_NAME[view.trickWinnerSeat]}</strong> wint de slag
          {view.trickPoints !== null && <> ({view.trickPoints} punten</>}
          {view.trickRoem ? <>, +{view.trickRoem} roem</> : null}
          {view.trickPoints !== null && <>)</>}.{" "}
          <span className={wij ? "wij" : "zij"}>{wij ? "Voor ons." : "Voor hen."}</span>
          <span className="panel__tricks">
            Slagen — Wij: {view.tricksWon[0]} · Zij: {view.tricksWon[1]}
          </span>
        </div>
        <button className="btn btn--primary" onClick={onContinue}>
          Volgende slag →
        </button>
      </div>
    );
  }

  return (
    <div className="panel">
      <PlayBanner makerSeat={view.makerSeat} bid={view.bid} contract={view.contract} />
      <div className="panel__info">
        {view.currentSeat === HUMAN ? (
          <strong>Jouw beurt — speel een kaart.</strong>
        ) : (
          <>{SEAT_NAME[view.currentSeat]} is aan zet…</>
        )}
        <span className="panel__tricks">
          Slagen — Wij: {view.tricksWon[0]} · Zij: {view.tricksWon[1]}
        </span>
      </div>
    </div>
  );
}

function RoundSummary({ view }: { view: GameView }) {
  if (!view.result) {
    return <div className="panel__info">{view.message}</div>;
  }
  const r = view.result;
  const makerWij = r.makerTeam === 0;
  return (
    <div className="panel__info">
      <strong>Ronde afgelopen.</strong>{" "}
      {makerWij ? "Wij" : "Zij"} speelden{" "}
      {view.bid !== null && view.contract && (
        <>
          {view.bid} {contractLabel(view.contract)}
        </>
      )}
      {". "}
      {r.nat ? (
        <span className="nat">{makerWij ? "Wij gingen nat!" : "Zij gingen nat!"}</span>
      ) : (
        <span>Bod gehaald.</span>
      )}{" "}
      Punten — Wij: {r.points[0]} (op papier {r.paper[0]}) · Zij: {r.points[1]} (op papier {r.paper[1]}).
      {r.pitTeam !== null && <strong> Pit voor {r.pitTeam === 0 ? "ons" : "hen"}! (+100)</strong>}
    </div>
  );
}

// Hand sorteren op kleur en daarna op rang (voor de weergave).
const SUIT_ORDER = ["schoppen", "harten", "klaveren", "ruiten"];
const RANK_ORDER = ["7", "8", "9", "10", "B", "V", "H", "A"];
function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => {
    const s = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
    if (s !== 0) return s;
    return RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
  });
}
