import type { GameState } from "../state/types";
import { hexDistance } from "../map/Hex";
import { MovementSystem } from "./MovementSystem";
import { CombatSystem } from "./CombatSystem";

export class AISystem {
  constructor(
    private state: GameState,
    private movement: MovementSystem,
    private combat: CombatSystem
  ) {}

  run(): void {
    const units = this.state.units.filter(u => u.owner === "ai" && u.hp > 0);
    for (const unit of units) {
      const adjacentPlayer = this.state.units.find(u => u.owner === "player" && u.hp > 0 && hexDistance(unit, u) <= 1);
      if (adjacentPlayer) { this.combat.attackUnit(unit, adjacentPlayer); continue; }

      const adjacentCity = this.state.cities.find(c => c.owner === "player" && c.hp > 0 && hexDistance(unit, c) <= 1);
      if (adjacentCity) { this.combat.attackCity(unit, adjacentCity.id); continue; }

      const target = this.closestTarget(unit.q, unit.r);
      if (!target) continue;
      const reachable = this.movement.getReachable(unit)
        .sort((a, b) => hexDistance(a.tile, target) - hexDistance(b.tile, target) || a.cost - b.cost);
      if (reachable[0]) this.movement.moveTo(unit, reachable[0].tile);

      const afterUnit = this.state.units.find(u => u.owner === "player" && u.hp > 0 && hexDistance(unit, u) <= 1);
      if (afterUnit && unit.movement > 0) this.combat.attackUnit(unit, afterUnit);
      const afterCity = this.state.cities.find(c => c.owner === "player" && c.hp > 0 && hexDistance(unit, c) <= 1);
      if (afterCity && unit.movement > 0) this.combat.attackCity(unit, afterCity.id);
    }
  }

  private closestTarget(q: number, r: number) {
    const targets = [
      ...this.state.cities.filter(c => c.owner === "player" && c.hp > 0),
      ...this.state.units.filter(u => u.owner === "player" && u.hp > 0)
    ];
    return targets.sort((a, b) => hexDistance({ q, r }, a) - hexDistance({ q, r }, b))[0];
  }
}
