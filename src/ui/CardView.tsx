import { Card } from "../engine";
import { SUIT_SYMBOL, isRed } from "./display";

interface Props {
  card: Card;
  onClick?: () => void;
  playable?: boolean;
  dimmed?: boolean;
}

export function CardView({ card, onClick, playable, dimmed }: Props) {
  const cls = [
    "card",
    isRed(card.suit) ? "card--red" : "card--black",
    playable ? "card--playable" : "",
    dimmed ? "card--dimmed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={cls} onClick={onClick} disabled={!onClick}>
      <span className="card__rank">{card.rank}</span>
      <span className="card__suit">{SUIT_SYMBOL[card.suit]}</span>
    </button>
  );
}

export function CardBack() {
  return <div className="card card--back" aria-hidden />;
}
