import buildings from "../../data/buildings.json";
import type { CityState } from "../state/types";
import type { YieldBundle } from "../state/types";

type BuildingDefinition = {
  id: string;
  name: string;
  cost: number;
  yield: Partial<YieldBundle>;
};

export class BuildingSystem {
  private list = buildings as BuildingDefinition[];

  canBuild(city: CityState, id: string): boolean {
    return !city.buildings?.includes(id) && this.list.some(b => b.id === id);
  }

  build(city: CityState, id: string): boolean {
    if (!this.canBuild(city, id)) return false;
    city.buildings ??= [];
    city.buildings.push(id);
    return true;
  }

  getYield(city: CityState): Partial<YieldBundle> {
    const result: Partial<YieldBundle> = {};
    for (const id of city.buildings ?? []) {
      const building = this.list.find(b => b.id === id);
      if (!building) continue;
      for (const key of Object.keys(building.yield) as (keyof YieldBundle)[]) {
        result[key] = (result[key] ?? 0) + (building.yield[key] ?? 0);
      }
    }
    return result;
  }
}
