import type { GameState } from "../state/types";

const SAVE_KEY = "hero-civilization-engine-save-v04";
const LEGACY_KEYS = ["hero-civilization-engine-save-v02"];

export class SaveSystem {
  save(state: GameState): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  load(): GameState | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY) ?? LEGACY_KEYS.map(k => localStorage.getItem(k)).find(Boolean);
      if (!raw) return null;
      const state = JSON.parse(raw) as GameState;
      state.version = 4;
      for (const tile of state.tiles) {
        tile.pokemonHp ??= null;
        tile.pokemonMaxHp ??= null;
      }
      for (const city of state.cities) {
        city.food ??= 0;
        city.production ??= 0;
        city.productionQueue ??= ["warrior"];
      }
      for (const unit of state.units) {
        unit.skillUsed ??= false;
        unit.mirrorUsed ??= false;
        unit.empoweredAttack ??= 0;
      }
      return state;
    } catch {
      return null;
    }
  }
}
