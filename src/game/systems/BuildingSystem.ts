import type { CityState, GameState, YieldBundle } from "../state/types";
import buildings from "../../data/buildings.json";

type BuildingDefinition = {
  id: string;
  name: string;
  cost: number;
  effects: Partial<YieldBundle>;
  description: string;
};

export class BuildingSystem {
  private definitions = buildings as BuildingDefinition[];

  constructor(private state: GameState) {}

  definition(id: string): BuildingDefinition | undefined {
    return this.definitions.find(b => b.id === id);
  }

  canBuild(city: CityState, id: string): boolean {
    const building = this.definition(id);
    if (!building) return false;
    return !city.buildings?.includes(id) && city.production >= building.cost;
  }

  build(city: CityState, id: string): boolean {
    if (!this.canBuild(city, id)) return false;
    const building = this.definition(id)!;
    city.production -= building.cost;
    city.buildings ??= [];
    city.buildings.push(id);
    return true;
  }

  getYieldBonus(city: CityState): Partial<YieldBundle> {
    const result: Partial<YieldBundle> = {};
    for (const id of city.buildings ?? []) {
      const effects = this.definition(id)?.effects;
      if (!effects) continue;
      for (const key of Object.keys(effects) as (keyof YieldBundle)[]) {
        result[key] = (result[key] ?? 0) + (effects[key] ?? 0);
      }
    }
    return result;
  }
}
