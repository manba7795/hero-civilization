import type { GameState } from "../state/types";
import legendaryPokemon from "../../data/legendary_pokemon.json";

type LegendaryPokemon = {
  id: string;
  name: string;
  type: string;
  unique: boolean;
};

export class LegendaryPokemonSystem {
  private definitions = legendaryPokemon as LegendaryPokemon[];

  constructor(private state: GameState) {}

  available(): LegendaryPokemon[] {
    return this.definitions.filter(p => !this.state.legendaryPokemon.includes(p.id));
  }

  claim(id: string): boolean {
    const target = this.definitions.find(p => p.id === id);
    if (!target || this.state.legendaryPokemon.includes(id)) return false;
    this.state.legendaryPokemon.push(id);
    return true;
  }
}
