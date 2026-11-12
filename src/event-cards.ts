/** EVENT 只組合既有發射、Boss 鐘與爆發規則；順序固定，供 seeded RNG 抽取。 */
export const EVENT_CARDS = [
  { id: 'extra-shot', name: '多留一發' },
  { id: 'change-material', name: '換個材質' },
  { id: 'rewind', name: '鐘慢一拍' },
  { id: 'double-burst', name: '雙倍共鳴' },
  { id: 'burst-now', name: '即刻釋放' },
  { id: 'chip-boss', name: '輕敲核心' },
] as const;
export type EventCardId = typeof EVENT_CARDS[number]['id'];
export interface DrawnCard {
  id: EventCardId; name: string; effect: string; turn: number; tick: number;
  targetBallId?: number; material?: number;
}
