import type { GameState, TileState, UnitState } from "../state/types";
import { hexDistance } from "../map/Hex";
import pokemon from "../../data/pokemon.json";

type PokemonDefinition = {
  id: string;
  name: string;
  rarity: number;
  habitats: string[];
  partnerBonus: string;
  hp: number;
  attack: number;
  modifiers?: Record<string, number>;
};

export class PokemonSystem {
  private definitions = pokemon as unknown as PokemonDefinition[];
  constructor(private state: GameState) {}

  definition(id?: string | null): PokemonDefinition | undefined {
    return id ? this.definitions.find(p => p.id === id) : undefined;
  }

  spawnWildPokemon(): void {
    const candidates = this.state.tiles.filter(
      t => t.terrain !== "ocean" && t.elevation !== "mountain" && !t.pokemonSpawnId &&
        !this.state.units.some(u => u.hp > 0 && u.q === t.q && u.r === t.r) &&
        !this.state.cities.some(c => c.hp > 0 && c.q === t.q && c.r === t.r)
    );
    if (!candidates.length) return;
    const tile = candidates[Math.floor(Math.random() * candidates.length)];
    const habitat = tile.feature ?? (tile.elevation === "hill" ? "hill" : tile.terrain);
    const pool = this.definitions.filter(p => p.habitats.includes(habitat));
    if (!pool.length) return;
    const weighted = pool.flatMap(p => Array(Math.max(1, 6 - p.rarity)).fill(p));
    const picked = weighted[Math.floor(Math.random() * weighted.length)];
    tile.pokemonSpawnId = picked.id;
    tile.pokemonHp = picked.hp;
    tile.pokemonMaxHp = picked.hp;
  }

  attackWild(attacker: UnitState, tile: TileState, damage: number): { damage: number; retaliation: number; defeated: boolean } | null {
    const def = this.definition(tile.pokemonSpawnId);
    if (!def || tile.pokemonHp == null || hexDistance(attacker, tile) > 1) return null;
    const dealt = Math.max(5, damage + Math.floor(Math.random() * 7) - Math.floor(def.attack * 0.25));
    tile.pokemonHp = Math.max(0, tile.pokemonHp - dealt);
    const retaliation = tile.pokemonHp > 0 ? Math.max(2, def.attack - Math.floor(damage * 0.18)) : 0;
    attacker.hp -= retaliation;
    const defeated = tile.pokemonHp <= 0;
    if (defeated) this.clearWild(tile);
    return { damage: dealt, retaliation, defeated };
  }

  capture(tile: TileState, actor: UnitState): { success: boolean; chance: number; name?: string } {
    if (!tile.pokemonSpawnId || this.state.pokeballs <= 0 || hexDistance(actor, tile) > 1) return { success: false, chance: 0 };
    const def = this.definition(tile.pokemonSpawnId);
    if (!def) return { success: false, chance: 0 };
    this.state.pokeballs -= 1;
    const hp = tile.pokemonHp ?? def.hp;
    const maxHp = tile.pokemonMaxHp ?? def.hp;
    const weakened = 1 - hp / Math.max(1, maxHp);
    const chance = Math.max(0.08, Math.min(0.90, 0.34 + weakened * 0.52 - def.rarity * 0.055));
    if (Math.random() >= chance) return { success: false, chance, name: def.name };
    this.state.capturedPokemon.push(def.id);
    this.clearWild(tile);
    return { success: true, chance, name: def.name };
  }

  bindPartner(hero: UnitState, pokemonId: string): boolean {
    if (hero.type !== "hero") return false;
    const owned = this.state.capturedPokemon.filter(id => id === pokemonId).length;
    const used = this.state.units.filter(u => u.type === "hero" && u.id !== hero.id && u.pokemonPartnerId === pokemonId && u.hp > 0).length;
    if (owned <= used) return false;
    hero.pokemonPartnerId = pokemonId;
    return true;
  }

  private clearWild(tile: TileState): void {
    tile.pokemonSpawnId = null;
    tile.pokemonHp = null;
    tile.pokemonMaxHp = null;
  }
}
