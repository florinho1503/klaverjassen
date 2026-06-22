// Slagen: zitplaatsen, teams en het bepalen van de slagwinnaar.

import { Card, Contract, trickStrength } from "./cards";

/** Zitplaats: 0=Noord, 1=Oost, 2=Zuid, 3=West (met de klok mee). */
export type Seat = 0 | 1 | 2 | 3;

/** Team 0 = Noord/Zuid, team 1 = Oost/West. */
export type Team = 0 | 1;

export function teamOf(seat: Seat): Team {
  return (seat % 2) as Team;
}

export function partnerOf(seat: Seat): Seat {
  return ((seat + 2) % 4) as Seat;
}

export function nextSeat(seat: Seat): Seat {
  return ((seat + 1) % 4) as Seat;
}

/** Eén gespeelde kaart in een slag. */
export interface Play {
  seat: Seat;
  card: Card;
}

/**
 * Index in `plays` van de winnende kaart. De eerste kaart bepaalt de gevraagde
 * kleur (ledSuit). `plays` mag 1..4 kaarten bevatten (ook een lopende slag).
 */
export function trickWinnerIndex(plays: Play[], contract: Contract): number {
  if (plays.length === 0) throw new Error("Lege slag heeft geen winnaar");
  const ledSuit = plays[0].card.suit;
  let bestIdx = 0;
  let bestStrength = trickStrength(plays[0].card, contract, ledSuit);
  for (let i = 1; i < plays.length; i++) {
    const s = trickStrength(plays[i].card, contract, ledSuit);
    if (s > bestStrength) {
      bestStrength = s;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** Welke zitplaats wint de (deel)slag op dit moment? */
export function trickWinnerSeat(plays: Play[], contract: Contract): Seat {
  return plays[trickWinnerIndex(plays, contract)].seat;
}
