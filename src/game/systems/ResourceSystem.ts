import type { GameState, TileState, YieldBundle } from "../state/types";
import resources from "../../../data/resources.json";

type ResourceDefinition = {
  id: string;
  name: string;
  type: string;
  food?: number;
  production?: number;
  science?: number;
};

export class ResourceSystem {
  private definitions = resources as ResourceDefinition[];

  constructor(private state: GameState) {}

  definition(id: string | null): ResourceDefinition | undefined {
    return this.definitions.find(r => r.id === id);
  }

  apply(tile: TileState, yieldData: YieldBundle): void {
    const resource = this.definition(tile.resource);
    if (!resource) return;
    yieldData.food += resource.food ?? 0;
    yieldData.production += resource.production ?? 0;
    yieldData.science += resource.science ?? 0;
  }

  count(id: string, owner: string): number {
    return this.state.tiles.filter(t => t.resource === id && t.owner === owner).length;
  }
}
