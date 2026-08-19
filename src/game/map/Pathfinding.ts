import type { TileState, UnitState } from "../state/types";
import { HEX_DIRECTIONS, hexKey, hexDistance } from "./Hex";

export type PathResult = { tiles: TileState[]; cost: number };

function moveCost(tile: TileState): number {
  if (tile.terrain === "ocean" || tile.terrain === "coast" || tile.elevation === "mountain") return Infinity;
  let cost = 1;
  if (tile.elevation === "hill") cost += 1;
  if (tile.feature === "forest") cost += 1;
  return cost;
}

export function findPath(
  tiles: TileState[],
  unit: UnitState,
  target: TileState,
  occupied: Set<string>
): PathResult | null {
  const byKey = new Map(tiles.map(t => [hexKey(t), t]));
  const start = byKey.get(hexKey(unit));
  if (!start) return null;

  const open = new Set<string>([hexKey(start)]);
  const came = new Map<string, string>();
  const g = new Map<string, number>([[hexKey(start), 0]]);
  const f = new Map<string, number>([[hexKey(start), hexDistance(start, target)]]);

  while (open.size) {
    let currentKey = "";
    let currentScore = Infinity;
    for (const key of open) {
      const score = f.get(key) ?? Infinity;
      if (score < currentScore) { currentScore = score; currentKey = key; }
    }
    const current = byKey.get(currentKey)!;
    if (current.q === target.q && current.r === target.r) {
      const path: TileState[] = [];
      let k = currentKey;
      while (k !== hexKey(start)) {
        path.push(byKey.get(k)!);
        k = came.get(k)!;
      }
      path.reverse();
      return { tiles: path, cost: g.get(currentKey) ?? 0 };
    }
    open.delete(currentKey);

    for (const dir of HEX_DIRECTIONS) {
      const next = byKey.get(`${current.q + dir.q},${current.r + dir.r}`);
      if (!next) continue;
      const key = hexKey(next);
      const cost = moveCost(next);
      if (!Number.isFinite(cost)) continue;
      if (occupied.has(key) && key !== hexKey(target)) continue;
      const tentative = (g.get(currentKey) ?? Infinity) + cost;
      if (tentative < (g.get(key) ?? Infinity)) {
        came.set(key, currentKey);
        g.set(key, tentative);
        f.set(key, tentative + hexDistance(next, target));
        open.add(key);
      }
    }
  }
  return null;
}

export function reachableTiles(
  tiles: TileState[],
  unit: UnitState,
  occupied: Set<string>
): Array<{ tile: TileState; cost: number }> {
  const byKey = new Map(tiles.map(t => [hexKey(t), t]));
  const startKey = hexKey(unit);
  const best = new Map<string, number>([[startKey, 0]]);
  const queue: Array<{ key: string; cost: number }> = [{ key: startKey, cost: 0 }];
  const result: Array<{ tile: TileState; cost: number }> = [];

  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    const tile = byKey.get(current.key)!;
    for (const dir of HEX_DIRECTIONS) {
      const next = byKey.get(`${tile.q + dir.q},${tile.r + dir.r}`);
      if (!next) continue;
      const key = hexKey(next);
      const step = moveCost(next);
      if (!Number.isFinite(step) || occupied.has(key)) continue;
      const cost = current.cost + step;
      if (cost > unit.movement || cost >= (best.get(key) ?? Infinity)) continue;
      best.set(key, cost);
      queue.push({ key, cost });
      result.push({ tile: next, cost });
    }
  }
  return result;
}
