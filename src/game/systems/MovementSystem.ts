import type { GameState, TileState, UnitState } from "../state/types";
import { hexKey } from "../map/Hex";
import { findPath, reachableTiles } from "../map/Pathfinding";

export class MovementSystem {
  constructor(private state: GameState) {}

  getTile(q: number, r: number): TileState | undefined {
    return this.state.tiles.find(t => t.q === q && t.r === r);
  }

  getUnitAt(q: number, r: number): UnitState | undefined {
    return this.state.units.find(u => u.q === q && u.r === r && u.hp > 0);
  }

  occupied(except?: UnitState): Set<string> {
    return new Set(this.state.units.filter(u => u.hp > 0 && u.id !== except?.id).map(u => hexKey(u)));
  }

  canEnter(unit: UnitState, tile: TileState): boolean {
    if (tile.terrain === "ocean" || tile.terrain === "coast" || tile.elevation === "mountain") return false;
    if (tile.pokemonSpawnId) return false;
    const blocker = this.getUnitAt(tile.q, tile.r);
    if (blocker && blocker.id !== unit.id) return false;
    if (this.state.cities.some(c => c.hp > 0 && c.q === tile.q && c.r === tile.r)) return false;
    return true;
  }

  getReachable(unit: UnitState): Array<{ tile: TileState; cost: number }> {
    const blocked = this.occupied(unit);
    for (const city of this.state.cities.filter(c => c.hp > 0)) blocked.add(hexKey(city));
    for (const tile of this.state.tiles.filter(t => t.pokemonSpawnId)) blocked.add(hexKey(tile));
    return reachableTiles(this.state.tiles, unit, blocked);
  }

  moveTo(unit: UnitState, tile: TileState): boolean {
    if (unit.movement <= 0 || !this.canEnter(unit, tile)) return false;
    const blocked = this.occupied(unit);
    for (const city of this.state.cities.filter(c => c.hp > 0)) blocked.add(hexKey(city));
    for (const wild of this.state.tiles.filter(t => t.pokemonSpawnId)) blocked.add(hexKey(wild));
    blocked.delete(hexKey(tile));
    const path = findPath(this.state.tiles, unit, tile, blocked);
    if (!path || path.cost > unit.movement) return false;
    unit.q = tile.q;
    unit.r = tile.r;
    unit.movement -= path.cost;
    return true;
  }
}
