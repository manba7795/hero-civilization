import type { GameState, UnitState } from "../state/types";
import artifacts from "../../data/artifacts.json";

type ArtifactDefinition = {
  id: string;
  name: string;
  rarity: string;
  description: string;
};

export class ArtifactSystem {
  private definitions = artifacts as ArtifactDefinition[];
  constructor(private state: GameState) {}

  rollChoices(count = 3): ArtifactDefinition[] {
    const pool = [...this.definitions].sort(() => Math.random() - 0.5);
    return pool.slice(0, count);
  }

  grant(artifactId: string): void {
    this.state.artifactInventory.push(artifactId);
  }

  equip(hero: UnitState, artifactId: string): boolean {
    if (hero.type !== "hero") return false;
    hero.artifactIds ??= [];
    if (hero.artifactIds.length >= 3) return false;
    const index = this.state.artifactInventory.indexOf(artifactId);
    if (index < 0) return false;
    this.state.artifactInventory.splice(index, 1);
    hero.artifactIds.push(artifactId);
    return true;
  }
}
