import type { GameState, UnitState } from "../state/types";
import heroes from "../../data/heroes.json";
import artifacts from "../../data/artifacts.json";
import pokemon from "../../data/pokemon.json";

type Modifiers = {
  attack?: number;
  hp?: number;
  movement?: number;
  skillPower?: number;
  skillRange?: number;
  killGold?: number;
  empoweredAttack?: number;
  surviveLethal?: boolean;
  regen?: number;
};

type HeroDef = {
  id: string; name: string; role: string; hp: number; attack: number; movement: number; cost: number;
  skill: { name: string; power: number; range: number; kind: "damage" | "dash" };
};

type ArtifactDef = { id: string; name: string; modifiers?: Modifiers };
type PokemonDef = { id: string; name: string; hp: number; attack: number; modifiers?: Modifiers };

export class StatsSystem {
  private heroDefs = heroes as HeroDef[];
  private artifactDefs = artifacts as ArtifactDef[];
  private pokemonDefs = pokemon as PokemonDef[];

  constructor(private state: GameState) {}

  hero(unit: UnitState): HeroDef | undefined {
    return unit.heroId ? this.heroDefs.find(h => h.id === unit.heroId) : undefined;
  }

  pokemon(id?: string | null): PokemonDef | undefined {
    return id ? this.pokemonDefs.find(p => p.id === id) : undefined;
  }

  modifiers(unit: UnitState): Modifiers {
    const out: Modifiers = {};
    const add = (mods?: Modifiers) => {
      if (!mods) return;
      for (const key of ["attack","hp","movement","skillPower","skillRange","killGold","empoweredAttack","regen"] as const) {
        out[key] = (out[key] ?? 0) + (mods[key] ?? 0);
      }
      if (mods.surviveLethal) out.surviveLethal = true;
    };
    for (const id of unit.artifactIds ?? []) add(this.artifactDefs.find(a => a.id === id)?.modifiers);
    add(this.pokemon(unit.pokemonPartnerId)?.modifiers);
    return out;
  }

  maxHp(unit: UnitState): number {
    const base = unit.type === "hero" ? this.hero(unit)?.hp ?? 100 : 100;
    return base + (this.modifiers(unit).hp ?? 0);
  }

  attack(unit: UnitState): number {
    const base = unit.type === "hero" ? this.hero(unit)?.attack ?? 18 : unit.type === "warrior" ? 18 : 5;
    return base + (this.modifiers(unit).attack ?? 0) + (unit.empoweredAttack ?? 0);
  }

  maxMovement(unit: UnitState): number {
    const base = unit.type === "hero" ? this.hero(unit)?.movement ?? 3 : 2;
    return base + (this.modifiers(unit).movement ?? 0);
  }

  skillPower(unit: UnitState): number {
    return (this.hero(unit)?.skill.power ?? 0) + (this.modifiers(unit).skillPower ?? 0);
  }

  skillRange(unit: UnitState): number {
    return (this.hero(unit)?.skill.range ?? 0) + (this.modifiers(unit).skillRange ?? 0);
  }

  regen(unit: UnitState): number { return this.modifiers(unit).regen ?? 0; }
  killGold(unit: UnitState): number { return this.modifiers(unit).killGold ?? 0; }
  empoweredAttackBonus(unit: UnitState): number { return this.modifiers(unit).empoweredAttack ?? 0; }
  canSurviveLethal(unit: UnitState): boolean { return !!this.modifiers(unit).surviveLethal; }
}
