import type { GameState, TileState, UnitState } from "../state/types";
import { hexDistance } from "../map/Hex";
import { StatsSystem } from "./StatsSystem";
import { PokemonSystem } from "./PokemonSystem";

export class CombatSystem {
  constructor(
    private state: GameState,
    private stats: StatsSystem,
    private pokemon: PokemonSystem
  ) {}

  attackUnit(attacker: UnitState, defender: UnitState): boolean {
    if (attacker.owner === defender.owner || attacker.movement <= 0 || hexDistance(attacker, defender) > 1) return false;
    const atk = this.stats.attack(attacker);
    const defAtk = this.stats.attack(defender);
    const damage = Math.max(7, Math.round(18 + atk * 0.72 - defAtk * 0.18));
    const retaliation = Math.max(4, Math.round(8 + defAtk * 0.34 - atk * 0.08));
    defender.hp -= damage;
    if (defender.hp > 0) attacker.hp -= retaliation;
    attacker.movement = 0;
    attacker.empoweredAttack = 0;
    this.applyLethalProtection(attacker);
    this.applyLethalProtection(defender);
    if (defender.hp <= 0) this.state.gold += attacker.owner === "player" ? this.stats.killGold(attacker) : 0;
    return true;
  }

  attackCity(attacker: UnitState, cityId: string): boolean {
    const city = this.state.cities.find(c => c.id === cityId && c.hp > 0);
    if (!city || city.owner === attacker.owner || attacker.movement <= 0 || hexDistance(attacker, city) > 1) return false;
    const damage = Math.max(6, Math.round(12 + this.stats.attack(attacker) * 0.55));
    city.hp -= damage;
    attacker.hp -= 6;
    attacker.movement = 0;
    this.applyLethalProtection(attacker);
    if (city.hp <= 0) {
      city.owner = attacker.owner;
      city.hp = 65;
      city.population = Math.max(1, city.population - 1);
      for (const tile of this.state.tiles) {
        if (hexDistance(tile, city) <= 1) tile.owner = attacker.owner;
      }
    }
    return true;
  }

  attackWild(attacker: UnitState, tile: TileState): boolean {
    if (attacker.movement <= 0) return false;
    const result = this.pokemon.attackWild(attacker, tile, this.stats.attack(attacker));
    if (!result) return false;
    attacker.movement = 0;
    attacker.empoweredAttack = 0;
    this.applyLethalProtection(attacker);
    return true;
  }

  useHeroSkill(hero: UnitState, targetTile: TileState): boolean {
    const def = this.stats.hero(hero);
    if (!def || hero.skillUsed) return false;

    if (def.skill.kind === "dash") {
      if (hexDistance(hero, targetTile) > def.skill.range || targetTile.elevation === "mountain" || targetTile.terrain === "ocean" || targetTile.terrain === "coast") return false;
      if (this.state.units.some(u => u.hp > 0 && u.q === targetTile.q && u.r === targetTile.r && u.id !== hero.id)) return false;
      if (targetTile.pokemonSpawnId || this.state.cities.some(c => c.hp > 0 && c.q === targetTile.q && c.r === targetTile.r)) return false;
      hero.q = targetTile.q; hero.r = targetTile.r;
      hero.hp = Math.min(this.stats.maxHp(hero), hero.hp + 20);
      hero.skillUsed = true;
      return true;
    }

    if (hexDistance(hero, targetTile) > this.stats.skillRange(hero)) return false;
    const enemy = this.state.units.find(u => u.hp > 0 && u.owner !== hero.owner && u.q === targetTile.q && u.r === targetTile.r);
    const damage = this.stats.skillPower(hero);
    if (enemy) {
      enemy.hp -= damage;
      this.applyLethalProtection(enemy);
    } else if (targetTile.pokemonSpawnId && targetTile.pokemonHp != null) {
      targetTile.pokemonHp = Math.max(0, targetTile.pokemonHp - damage);
      if (targetTile.pokemonHp <= 0) {
        targetTile.pokemonSpawnId = null; targetTile.pokemonHp = null; targetTile.pokemonMaxHp = null;
      }
    } else return false;

    hero.skillUsed = true;
    const empowered = this.stats.empoweredAttackBonus(hero);
    if (empowered > 0) hero.empoweredAttack = empowered;
    return true;
  }

  private applyLethalProtection(unit: UnitState): void {
    if (unit.hp > 0) return;
    if (unit.type === "hero" && this.stats.canSurviveLethal(unit) && !unit.mirrorUsed) {
      unit.mirrorUsed = true;
      unit.hp = 1;
    }
  }
}
