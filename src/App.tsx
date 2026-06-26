import { useEffect, useState } from "react";
import { BidAction, Card, Contract, Difficulty, Seat, cardEquals } from "./engine";
import { AuctionLogEntry, DecisionReview, RoundReview, Verdict } from "./engine";
import { CardBack, CardView } from "./ui/CardView";
import {
  SEAT_NAME,
  SUIT_SYMBOL,
  contractLabel,
  contractShort,
  isRed,
} from "./ui/display";
import { BidOption, GameTarget, GameView, HUMAN, TelstaatRow, useGame } from "./ui/useGame";
import "./App.css";

const LEVEL_META: Record<Difficulty, { emoji: string; label: string; desc: string }> = {
  beginner: {
    emoji: "🟢",
    label: "Beginner",
    desc: "Eenvoudige bots, geldige kaarten worden voor je opgelicht en de coach is mild.",
  },
  gevorderd: {
    emoji: "🟡",
    label: "Gevorderd",
    desc: "Slimmere bots (kaartgeheugen, troefbeheer, seinen). Geen hulp: foutmelding bij een ongeldige zet en strenge klop-regels.",
  },
  expert: {
    emoji: "🔴",
    label: "Expert",
    desc: "Sterkste bots (Monte-Carlo + bied-inferentie).",
  },
};

// Voorlopig speelbare niveaus.
const AVAILABLE_LEVELS: Difficulty[] = ["beginner", "gevorderd"];

function Stepper({
  label,
  value,
  set,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  set: (n: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div className="stepper">
      <button
        type="button"
        className="btn btn--step"
        onClick={() => set(Math.max(min, value - step))}
        disabled={value <= min}
      >
        −
      </button>
      <span className="stepper__value">
        {value} <small>{label}</small>
      </span>
      <button
        type="button"
        className="btn btn--step"
        onClick={() => set(Math.min(max, value + step))}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}

function StartScreen({ onStart }: { onStart: (d: Difficulty, t: GameTarget) => void }) {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [format, setFormat] = useState<"rondes" | "punten">("rondes");
  const [rounds, setRounds] = useState(16);
  const [points, setPoints] = useState(100);
  const [showRules, setShowRules] = useState(false);

  const start = () => {
    if (!difficulty) return;
    onStart(
      difficulty,
      format === "rondes" ? { type: "rondes", rounds } : { type: "punten", points },
    );
  };

  return (
    <div className="startscreen">
      <h1>Klaverjassen oefenen</h1>

      <p className="startscreen__sub">1. Kies je niveau</p>
      <div className="startscreen__levels">
        {AVAILABLE_LEVELS.map((d) => (
          <button
            key={d}
            type="button"
            className={`levelcard ${difficulty === d ? "levelcard--sel" : ""}`}
            onClick={() => setDifficulty(d)}
          >
            <span className="levelcard__emoji">{LEVEL_META[d].emoji}</span>
            <span className="levelcard__label">{LEVEL_META[d].label}</span>
            <span className="levelcard__desc">{LEVEL_META[d].desc}</span>
          </button>
        ))}
      </div>

      <p className="startscreen__sub">2. Hoe lang speel je?</p>
      <div className="startscreen__format">
        <div className="formatrow">
          <button
            type="button"
            className={`btn ${format === "rondes" ? "btn--sel" : ""}`}
            onClick={() => setFormat("rondes")}
          >
            Aantal rondes
          </button>
          <button
            type="button"
            className={`btn ${format === "punten" ? "btn--sel" : ""}`}
            onClick={() => setFormat("punten")}
          >
            Tot punten
          </button>
        </div>
        {format === "rondes" ? (
          <Stepper label="rondes" value={rounds} set={setRounds} min={4} max={32} step={4} />
        ) : (
          <Stepper label="punten" value={points} set={setPoints} min={50} max={300} step={10} />
        )}
      </div>

      <button
        type="button"
        className="btn btn--primary startscreen__go"
        disabled={!difficulty}
        onClick={start}
      >
        {difficulty ? "Start het potje" : "Kies eerst een niveau"}
      </button>

      <button type="button" className="startscreen__rules-link" onClick={() => setShowRules(true)}>
        📖 Uitleg &amp; regels
      </button>

      {showRules && <RulesOverlay onClose={() => setShowRules(false)} />}
    </div>
  );
}

function RulesOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="rulescard" onClick={(e) => e.stopPropagation()}>
        <div className="rulescard__head">
          <h2>📖 Klaverjassen — uitleg &amp; regels</h2>
          <button type="button" className="btn" onClick={onClose}>
            Sluiten
          </button>
        </div>

        <div className="rules">
          <h3>Het doel</h3>
          <ul>
            <li>4 spelers, 2 teams: jij + Noord (je maat) tegen Oost + West.</li>
            <li>32 kaarten (7 t/m aas), iedereen 8 kaarten.</li>
            <li>
              Eén team is <b>maker</b>: dat speelt en moet het geboden aantal punten halen. Lukt
              dat niet, dan ga je <b>nat</b> — álle punten gaan dan naar de tegenpartij.
            </li>
            <li>
              Je speelt met een <b>troefkleur</b>, of <b>sans</b> (zonder troef).
            </li>
          </ul>

          <h3>Kaartwaardes</h3>
          <div className="rules__tables">
            <ValuesTable title="Troef" rows={TROEF_VALUES} />
            <ValuesTable title="Niet-troef / sans" rows={PLAIN_VALUES} />
          </div>
          <p>
            In <b>troef</b> zijn de boer (20) en 9 (14) de toppers; in <b>sans/niet-troef</b> zijn
            ze juist (bijna) waardeloos. Aas en 10 zijn altijd 11 en 10. Totaal per spel:{" "}
            <b>162</b> (troefspel) of <b>130</b> (sans). De laatste slag is <b>+10</b> waard.
          </p>

          <h3>Slagvolgorde — welke kaart wint</h3>
          <ul>
            <li>
              <b>Troef</b> (hoog → laag): B → 9 → A → 10 → H → V → 8 → 7
            </li>
            <li>
              <b>Niet-troef / sans</b>: A → 10 → H → V → B → 9 → 8 → 7
            </li>
            <li>Troef verslaat elke niet-troefkaart. Bij sans wint de hoogste kaart van de gevraagde kleur.</li>
          </ul>

          <h3>Bieden</h3>
          <ul>
            <li>Je biedt een getal + een kleur of sans. Het getal is je belofte (je nat-grens).</li>
            <li>Het hoogste bod wint en wordt maker. Minimum: 80 voor een kleur, 70 voor sans; stappen van 10.</li>
            <li>
              <b>Passen haalt je er niet uit</b>: je mag er later alsnog overheen bieden. Het bieden
              stopt pas als iedereen achter elkaar past.
            </li>
            <li>Tip: bied als opener het minimum — hoger bieden geeft geen extra punten, alleen meer nat-risico.</li>
          </ul>

          <h3>Spelen</h3>
          <ul>
            <li>
              <b>Bekennen verplicht:</b> heb je de gevraagde kleur, dan moet je die spelen.
            </li>
            <li>
              Kun je niet bekennen en wint je <b>maat</b> de slag → je hoeft niet te troeven (maatslag).
            </li>
            <li>
              Kun je niet bekennen en wint de <b>tegenstander</b> → introeven verplicht (als je troef hebt).
            </li>
            <li>
              <b>Overtroeven:</b> speel je troef, dan hoger dan de hoogste troef die er ligt — tenzij
              dat niet kan. Je maat hoef je niet te overtroeven.
            </li>
          </ul>

          <h3>Klopjes (roem)</h3>
          <ul>
            <li>Stuk (Heer + Vrouw van troef): 20</li>
            <li>3 op een rij (zelfde kleur, opeenvolgend): 20</li>
            <li>4 op een rij: 50 — met het stuk erin: 70</li>
            <li>
              In deze app: win je een slag met een klopje erin, klik dan zelf op <b>Klop</b> om 'm te
              claimen. Klopjes gaan naar het team dat de slag wint — leg dus geen klopje vóór de
              tegenstander.
            </li>
          </ul>

          <h3>Pit</h3>
          <p>Wint één team alle 8 de slagen, dan krijgt dat team <b>+100</b> bonus.</p>

          <h3>Punten tellen</h3>
          <ul>
            <li>
              Tel de punten van alle kaarten in de slagen die je team won (ook de kaarten die de
              tegenstander erin legde), plus klopjes en +10 voor de laatste slag.
            </li>
            <li>De maker moet zijn bod halen, anders nat (alles naar de tegenpartij).</li>
            <li>"Op papier": punten gedeeld door 10, afgerond (vanaf 7 omhoog).</li>
          </ul>

          <h3>Seinen (samenspel met je maat)</h3>
          <p>
            Als je maat aan slag ligt en jij gooit af: <b>7 / 8 / 9 = aanseinen</b> ("ik heb de aas
            van deze kleur, speel 'm aub!"), <b>10 / B / H = afseinen</b> ("deze kleur wil ik niet").
          </p>

          <h3>Niveaus &amp; coach</h3>
          <ul>
            <li>
              <b>🟢 Beginner:</b> geldige kaarten worden opgelicht, milde coach, klop-herinneringen.
            </li>
            <li>
              <b>🟡 Gevorderd:</b> geen hulp, foutmelding bij een ongeldige zet, strenge klop-regels.
            </li>
            <li>Na elke ronde kun je met "Leer van je fouten" je eigen zetten laten nakijken.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const {
    view,
    begin,
    humanPlay,
    humanKlop,
    humanBid,
    continueTrick,
    nextRound,
    newGame,
    requestReview,
    closeReview,
  } = useGame();

  if (view.phase === "start") {
    return <StartScreen onStart={begin} />;
  }

  return (
    <div className="app">
      {view.reviewOpen && view.review && (
        <ReviewOverlay review={view.review} onClose={closeReview} />
      )}
      <header className="topbar">
        <div className="topbar__left">
          <h1>Klaverjassen oefenen</h1>
          {view.difficulty && (
            <span className="levelbadge">
              {LEVEL_META[view.difficulty].emoji} {LEVEL_META[view.difficulty].label}
            </span>
          )}
          {view.assist && <CardValuesHint />}
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
          {view.canKlop && (
            <button type="button" className="klop-btn" onClick={humanKlop}>
              Klop!
            </button>
          )}
          {view.klopMessage && <div className="klop-msg">{view.klopMessage}</div>}
        </div>

        <div className="south">
          <SeatLabel seat={HUMAN} view={view} />
          {view.error && <div className="playerror">⚠️ {view.error.message}</div>}
          <HumanHand view={view} onPlay={humanPlay} />
        </div>
      </div>

      <Panel
        view={view}
        onBid={humanBid}
        onNext={nextRound}
        onContinue={continueTrick}
        onNewGame={newGame}
        onReview={requestReview}
      />
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
  const canPlay = view.phase === "spelen" && !view.paused && view.currentSeat === HUMAN;
  const isLegal = (c: Card) => view.legalForHuman.some((l) => cardEquals(l, c));

  return (
    <div className="hand">
      {sorted.map((card) => {
        // 'beginner' (assist): geldige kaarten oplichten, ongeldige dimmen.
        // Anders: alle kaarten klikbaar, foutmelding volgt bij een ongeldige zet.
        const legal = isLegal(card);
        const playable = view.assist && canPlay && legal;
        const dimmed = view.assist && canPlay && !legal;
        const clickable = canPlay && (view.assist ? legal : true);
        const isError = !!view.error && cardEquals(view.error.card, card);
        return (
          <CardView
            key={`${card.suit}-${card.rank}${isError ? `-err${view.error!.nonce}` : ""}`}
            card={card}
            playable={playable}
            dimmed={dimmed}
            error={isError}
            onClick={clickable ? () => onPlay(card) : undefined}
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
  // Geen voorselectie: je moet zelf een contract aanklikken.
  const [key, setKey] = useState<string | null>(null);
  const selected = options.find((o) => optionKey(o.contract) === key) ?? null;
  const min = selected ? selected.value : 0;
  const max = selected && selected.contract.type === "sans" ? 130 : 160;

  const [value, setValue] = useState(0);

  // Bij het kiezen van een contract (of een ander contract): klem het bod binnen [min, max].
  useEffect(() => {
    if (selected) setValue((v) => (v < min ? min : v > max ? max : v));
  }, [min, max, key]);

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
            </button>
          );
        })}
      </div>

      {selected && (
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
      )}

      <div className="bidcontrols__actions">
        {selected && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onBid({ value, contract: selected.contract })}
          >
            Bied {value} {contractSymbol(selected.contract)}
          </button>
        )}
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
  onNewGame,
  onReview,
}: {
  view: GameView;
  onBid: (a: BidAction) => void;
  onNext: () => void;
  onContinue: () => void;
  onNewGame: () => void;
  onReview: () => void;
}) {
  if (view.phase === "klaar") {
    return (
      <div className="panel">
        {view.gameOver ? <GameOver view={view} /> : <RoundSummary view={view} />}
        <Telstaat rows={view.telstaat} totals={view.totalScore} />
        <div className="panel__actions">
          {view.canReview && (
            <button className="btn" onClick={onReview}>
              {view.review
                ? `🎓 Leer van je fouten (${view.review.mistakes + view.review.doubtful})`
                : "🎓 Coach analyseert…"}
            </button>
          )}
          {view.gameOver ? (
            <button className="btn btn--primary" onClick={onNewGame}>
              Nieuw potje
            </button>
          ) : (
            <button className="btn btn--primary" onClick={onNext}>
              Volgende ronde
            </button>
          )}
        </div>
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
          {!view.canKlop && view.trickRoem ? <>, +{view.trickRoem} voor klopje</> : null}
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
      <div className="panel__progress">{progressLabel(view)}</div>
    </div>
  );
}

function progressLabel(view: GameView): string {
  const t = view.target;
  if (!t) return "";
  if (t.type === "rondes") return `Ronde ${view.telstaat.length} van ${t.rounds}`;
  return `Eerste team tot ${t.points} punten wint`;
}

function GameOver({ view }: { view: GameView }) {
  const w = view.winner;
  return (
    <div className="panel__info gameover">
      <div className="gameover__title">
        {w === null ? "🤝 Gelijkspel!" : w === 0 ? "🎉 Jullie winnen het potje!" : "De tegenpartij wint het potje."}
      </div>
      Eindstand op papier — Wij: <strong>{view.totalScore[0]}</strong> · Zij:{" "}
      <strong>{view.totalScore[1]}</strong> (na {view.telstaat.length} rondes).
    </div>
  );
}

function Telstaat({ rows, totals }: { rows: TelstaatRow[]; totals: [number, number] }) {
  if (rows.length === 0) return null;
  return (
    <div className="telstaat">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Bod</th>
            <th>Wij</th>
            <th>Zij</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.round} className={r.nat ? "telstaat__nat" : ""}>
              <td>{r.round}</td>
              <td>
                {r.makerTeam === 0 ? "Wij" : "Zij"} {r.bid} {contractSymbol(r.contract)}
                {r.nat ? " · nat" : ""}
                {r.pitTeam !== null ? " · pit" : ""}
              </td>
              <td>{r.paper[0]}</td>
              <td>{r.paper[1]}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <td>Totaal</td>
            <td>{totals[0]}</td>
            <td>{totals[1]}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const VERDICT_META: Record<Verdict, { icon: string; cls: string; label: string }> = {
  goed: { icon: "✅", cls: "verdict--goed", label: "Goed" },
  twijfel: { icon: "⚠️", cls: "verdict--twijfel", label: "Twijfelachtig" },
  fout: { icon: "❌", cls: "verdict--fout", label: "Fout" },
};

// De situatie van één beslissing reconstrueren: wat er al lag, jouw hand toen.
function SituationView({ d }: { d: DecisionReview }) {
  return (
    <div className="situation">
      <div className="situation__label">Slag {d.trickNumber} · op tafel:</div>
      <div className="situation__trick">
        {d.trickSoFar.length === 0 ? (
          <span className="situation__lead">Jij kwam uit (niemand had nog gespeeld).</span>
        ) : (
          d.trickSoFar.map((p, i) => (
            <span key={i} className="situation__play">
              <span className="situation__seat">{SEAT_NAME[p.seat]}</span>
              <CardView card={p.card} />
            </span>
          ))
        )}
      </div>

      <div className="situation__label">Jouw kaarten toen:</div>
      <div className="situation__hand">
        {sortHand(d.handAtDecision).map((c) => (
          <CardView
            key={`${c.suit}-${c.rank}`}
            card={c}
            best={cardEquals(c, d.bestCard)}
            error={cardEquals(c, d.playedCard) && !cardEquals(c, d.bestCard)}
          />
        ))}
      </div>
      <div className="situation__legend">
        <span className="legend legend--chosen">jij speelde</span>
        <span className="legend legend--best">beter geweest</span>
      </div>

      <p className="situation__explanation">{d.explanation}</p>
    </div>
  );
}

function ReviewOverlay({ review, onClose }: { review: RoundReview; onClose: () => void }) {
  const flagged = review.decisions.filter((d) => d.verdict !== "goed");
  const [idx, setIdx] = useState(0);
  const bm = VERDICT_META[review.bid.verdict];
  const cur = Math.min(idx, Math.max(0, flagged.length - 1));
  const d = flagged[cur];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="reviewcard" onClick={(e) => e.stopPropagation()}>
        <div className="reviewcard__head">
          <h2>🎓 Leer van je fouten</h2>
          <button type="button" className="btn" onClick={onClose}>
            Sluiten
          </button>
        </div>

        <div className="reviewsummary">
          ✅ {review.good} goed · ⚠️ {review.doubtful} twijfel · ❌ {review.mistakes} fout
        </div>
        <div className={`bidreview ${bm.cls}`}>
          <strong>{bm.icon} Bod:</strong> {review.bid.explanation}
        </div>

        {flagged.length === 0 ? (
          <p className="situation__explanation">Geen speelfouten deze ronde — netjes gespeeld! 🎉</p>
        ) : (
          <>
            <div className="stepper-nav">
              <button
                type="button"
                className="btn btn--step"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={cur === 0}
              >
                ←
              </button>
              <span className={`stepper-nav__label ${VERDICT_META[d.verdict].cls}`}>
                {VERDICT_META[d.verdict].icon} {VERDICT_META[d.verdict].label} · {cur + 1} van{" "}
                {flagged.length}
              </span>
              <button
                type="button"
                className="btn btn--step"
                onClick={() => setIdx((i) => Math.min(flagged.length - 1, i + 1))}
                disabled={cur === flagged.length - 1}
              >
                →
              </button>
            </div>
            <SituationView d={d} />
          </>
        )}
      </div>
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
