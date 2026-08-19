import type { GameState } from "../state/types";
import type { EventBus } from "../../core/EventBus";
import { StatsSystem } from "./StatsSystem";

export class TurnSystem {
  constructor(private state: GameState, private events: EventBus, private stats: StatsSystem) {}

  advance(): void {
    this.state.turn += 1;
    for (const unit of this.state.units) {
      if (unit.hp <= 0) continue;
      unit.movement = this.stats.maxMovement(unit);
      unit.skillUsed = false;
      const regen = this.stats.regen(unit);
      if (regen > 0) unit.hp = Math.min(this.stats.maxHp(unit), unit.hp + regen);
    }
    this.events.emit("turn:ended", { turn: this.state.turn });
  }
}
