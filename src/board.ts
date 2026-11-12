import type { DrawnCard } from './event-cards';
export type GameMode = 'realtime' | 'board';
export type BoardPhase = 'roll' | 'rolling' | 'moving' | 'effect' | 'shooting' | 'settling';

export interface BoardState {
  phase: BoardPhase;
  turn: number;
  position: number;
  die: number;
  stepsLeft: number;
  phaseUntil: number;
  shotsLeft: number;
  nextTurnBonus: number;
  laps: number;
  bossClock: number;
  tuneMaterial: number | null;
  landed: boolean;
  rolls: { tick: number; turn: number; die: number }[];
  cards: DrawnCard[];
  nextMaterial: number | null;
  boostedBallId: number | null;
  burstNextBall: boolean;
}

export function createBoardState(): BoardState {
  return { phase: 'roll', turn: 0, position: 0, die: 0, stepsLeft: 0,
    phaseUntil: 0, shotsLeft: 0, nextTurnBonus: 0, laps: 0, bossClock: 0,
    tuneMaterial: null, landed: false, rolls: [], cards: [], nextMaterial: null,
    boostedBallId: null, burstNextBall: false };
}
