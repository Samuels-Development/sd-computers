import type { DesktopPosition } from '@/types';

export const ICON_W = 82;
export const ICON_H = 96;

export function desktopLayout(ids: string[], saved: Record<string, DesktopPosition>, cols: number, rows: number): Record<string, DesktopPosition> {
  const result: Record<string, DesktopPosition> = {};
  const occupied = new Set<string>();
  for (const id of ids) {
    const pos = saved[id];
    if (!pos) continue;
    const cell = { col: Math.max(0, Math.min(cols - 1, pos.col)), row: Math.max(0, Math.min(rows - 1, pos.row)) };
    const key = `${cell.col}:${cell.row}`;
    if (!occupied.has(key)) { result[id] = cell; occupied.add(key); }
  }
  let slot = 0;
  for (const id of ids) {
    if (result[id]) continue;
    while (occupied.has(`${Math.floor(slot / rows)}:${slot % rows}`)) slot++;
    result[id] = { col: Math.floor(slot / rows), row: slot % rows };
    occupied.add(`${result[id].col}:${result[id].row}`);
  }
  return result;
}
