import type { CityState, GameState, ProductionId, UnitState, YieldBundle } from "../state/types";
import { HEX_DIRECTIONS, hexDistance } from "../map/Hex";
import nations from "../../data/nations.json";

const PRODUCTION_COST: Record<ProductionId, number> = { warrior: 28, settler: 46 };

export class CitySystem {
  constructor(private state: GameState) {}

  canFoundCity(settler: UnitState): boolean {
    if (settler.type !== "settler") return false;
    const tile = this.state.tiles.find(t => t.q === settler.q && t.r === settler.r);
    if (!tile || tile.terrain === "ocean" || tile.terrain === "coast" || tile.elevation === "mountain") return false;
    return !this.state.cities.some(c => hexDistance(c, settler) < 3);
  }

  foundCity(settler: UnitState, name = "曙光城"): CityState | null {
    if (!this.canFoundCity(settler)) return null;
    const city: CityState = {
      id: `city_${crypto.randomUUID()}`,
      owner: settler.owner,
      name,
      q: settler.q,
      r: settler.r,
      population: 1,
      hp: 120,
      food: 0,
      production: 0,
      productionQueue: ["warrior"]
    };
    this.state.cities.push(city);
    this.state.units = this.state.units.filter(u => u.id !== settler.id);
    for (const tile of this.state.tiles) {
      if (hexDistance(tile, city) <= 1 && !tile.owner) tile.owner = city.owner;
    }
    return city;
  }

  setProduction(city: CityState, item: ProductionId): void {
    city.productionQueue = [item];
  }

  productionCost(item?: ProductionId): number {
    return item ? PRODUCTION_COST[item] : 0;
  }

  getYield(city: CityState): YieldBundle {
    const out: YieldBundle = { food: 2, production: 1, gold: 2, science: 1, culture: 1 };
    const workable = this.state.tiles
      .filter(t => hexDistance(t, city) <= 1)
      .sort((a, b) => hexDistance(a, city) - hexDistance(b, city))
      .slice(0, Math.min(1 + city.population, 7));

    for (const tile of workable) {
      if (tile.terrain === "grass") out.food += 2;
      if (tile.terrain === "plains") { out.food += 1; out.production += 1; }
      if (tile.terrain === "desert") out.production += 1;
      if (tile.terrain === "coast") { out.food += 1; out.gold += 1; }
      if (tile.elevation === "hill") out.production += 1;
      if (tile.feature === "forest") out.production += 1;
      if (tile.resource === "wheat") out.food += 1;
      if (tile.resource === "iron") out.production += 1;
    }

    if (city.owner === "player") {
      const nation = (nations as any[]).find(n => n.id === this.state.nationId);
      out.science += nation?.bonus?.sciencePerCity ?? 0;
      out.production += nation?.bonus?.productionPerCity ?? 0;
      out.food += nation?.bonus?.foodPerCity ?? 0;
    }
    return out;
  }

  processTurn(city: CityState): { completed?: ProductionId; grew?: boolean } {
    const y = this.getYield(city);
    if (city.owner === "player") {
      this.state.gold += y.gold;
      this.state.science += y.science;
      this.state.culture += y.culture;
    }

    city.food += y.food;
    city.production += y.production;
    const growthCost = 16 + city.population * 8;
    let grew = false;
    if (city.food >= growthCost) {
      city.food -= growthCost;
      city.population += 1;
      grew = true;
    }

    const current = city.productionQueue[0];
    if (!current || city.production < PRODUCTION_COST[current]) return { grew };
    const spawn = this.findSpawnTile(city);
    if (!spawn) return { grew };

    city.production -= PRODUCTION_COST[current];
    const unit: UnitState = {
      id: `u_${current}_${crypto.randomUUID()}`,
      owner: city.owner,
      type: current,
      q: spawn.q,
      r: spawn.r,
      hp: 100,
      movement: 0
    };
    this.state.units.push(unit);
    return { completed: current, grew };
  }

  private findSpawnTile(city: CityState) {
    const candidates = [{ q: city.q, r: city.r }, ...HEX_DIRECTIONS.map(d => ({ q: city.q + d.q, r: city.r + d.r }))];
    return candidates
      .map(p => this.state.tiles.find(t => t.q === p.q && t.r === p.r))
      .find(t => t && t.terrain !== "ocean" && t.terrain !== "coast" && t.elevation !== "mountain" &&
        !t.pokemonSpawnId && !this.state.units.some(u => u.hp > 0 && u.q === t.q && u.r === t.r));
  }
}
