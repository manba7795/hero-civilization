import type { CityState, GameState, ProductionId, UnitState, YieldBundle } from "../state/types";
import { HEX_DIRECTIONS, hexDistance } from "../map/Hex";
import nations from "../../data/nations.json";
import { BuildingSystem } from "./BuildingSystem";

const PRODUCTION_COST: Record<string, number> = { warrior: 28, settler: 46 };

export class CitySystem {
  private buildingSystem: BuildingSystem;

  constructor(private state: GameState) {
    this.buildingSystem = new BuildingSystem();
  }

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
      productionQueue: ["warrior"],
      buildings: []
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
    if (!item) return 0;
    if (item.startsWith("building:")) {
      const id = item.replace("building:", "");
      return ({ granary: 40, barracks: 50, library: 60 } as Record<string, number>)[id] ?? 0;
    }
    return PRODUCTION_COST[item] ?? 0;
  }

  build(city: CityState, buildingId: string): boolean {
    return this.buildingSystem.build(city, buildingId);
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

    const buildingYield = this.buildingSystem.getYield(city);
    for (const key of Object.keys(buildingYield) as (keyof YieldBundle)[]) {
      out[key] += buildingYield[key] ?? 0;
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
    city.food += y.food;
    city.production += y.production;

    const current = city.productionQueue[0];
    if (!current || city.production < this.productionCost(current)) return {};

    city.production -= this.productionCost(current);

    if (current.startsWith("building:")) {
      this.buildingSystem.build(city, current.replace("building:", ""));
      return { completed: current };
    }

    const spawn = this.findSpawnTile(city);
    if (!spawn) return { completed: current };

    const unit: UnitState = {
      id: `u_${current}_${crypto.randomUUID()}`,
      owner: city.owner,
      type: current as UnitState["type"],
      q: spawn.q,
      r: spawn.r,
      hp: 100,
      movement: 0
    };
    this.state.units.push(unit);
    return { completed: current };
  }

  private findSpawnTile(city: CityState) {
    const candidates = [{ q: city.q, r: city.r }, ...HEX_DIRECTIONS.map(d => ({ q: city.q + d.q, r: city.r + d.r }))];
    return candidates
      .map(p => this.state.tiles.find(t => t.q === p.q && t.r === p.r))
      .find(t => t && t.terrain !== "ocean" && t.terrain !== "coast" && t.elevation !== "mountain" && !this.state.units.some(u => u.q === t.q && u.r === t.r));
  }
}
