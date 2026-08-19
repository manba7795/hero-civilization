import type { GameState, UnitState } from "../state/types";
import heroes from "../../data/heroes.json";

type HeroDefinition = {
  id: string; name: string; role: string; cost: number; hp: number; attack: number; movement: number;
  skill: { name: string; power: number; range: number; kind: "damage" | "dash" };
};

export class HeroSystem {
  private definitions = heroes as HeroDefinition[];
  constructor(private state: GameState) {}

  listAvailableHeroes(): HeroDefinition[] {
    const recruited = new Set(this.state.units.filter(u => u.heroId && u.hp > 0).map(u => u.heroId));
    return this.definitions.filter(h => !recruited.has(h.id));
  }

  recruit(heroId: string, q: number, r: number): UnitState | null {
    const hero = this.definitions.find(h => h.id === heroId);
    if (!hero || this.state.gold < hero.cost) return null;
    if (this.state.units.some(u => u.hp > 0 && u.q === q && u.r === r)) return null;
    this.state.gold -= hero.cost;
    const unit: UnitState = {
      id: `hero_${crypto.randomUUID()}`, owner: "player", type: "hero", q, r,
      hp: hero.hp, movement: hero.movement, heroId, artifactIds: [], skillUsed: false, mirrorUsed: false, empoweredAttack: 0
    };
    this.state.units.push(unit);
    return unit;
  }
}
