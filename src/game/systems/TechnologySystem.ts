import type { GameState } from "../state/types";
import technologies from "../../data/technologies.json";

type Technology = {
  id: string;
  name: string;
  cost: number;
  unlocks: string[];
};

export class TechnologySystem {
  private definitions = technologies as Technology[];

  constructor(private state: GameState) {}

  available(): Technology[] {
    return this.definitions.filter(t => !this.state.researchedTechs.includes(t.id));
  }

  research(id: string): boolean {
    const tech = this.definitions.find(t => t.id === id);
    if (!tech || this.state.researchedTechs.includes(id)) return false;
    if (this.state.science < tech.cost) return false;
    this.state.science -= tech.cost;
    this.state.researchedTechs.push(id);
    return true;
  }
}
