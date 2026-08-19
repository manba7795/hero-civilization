import { EventBus } from "./EventBus";
import { createInitialState } from "../game/state/createInitialState";
import type { CityState, GameState, ProductionId, TileState, UnitState } from "../game/state/types";
import { hexDistance } from "../game/map/Hex";
import { TurnSystem } from "../game/systems/TurnSystem";
import { CitySystem } from "../game/systems/CitySystem";
import { HeroSystem } from "../game/systems/HeroSystem";
import { ArtifactSystem } from "../game/systems/ArtifactSystem";
import { PokemonSystem } from "../game/systems/PokemonSystem";
import { MovementSystem } from "../game/systems/MovementSystem";
import { SaveSystem } from "../game/systems/SaveSystem";
import { StatsSystem } from "../game/systems/StatsSystem";
import { CombatSystem } from "../game/systems/CombatSystem";
import { AISystem } from "../game/systems/AISystem";
import { WorldRenderer } from "../render/WorldRenderer";
import { GameUI } from "../ui/GameUI";

export class Game {
  readonly events = new EventBus();
  state: GameState = createInitialState();

  turns!: TurnSystem;
  cities!: CitySystem;
  heroes!: HeroSystem;
  artifacts!: ArtifactSystem;
  pokemon!: PokemonSystem;
  movement!: MovementSystem;
  stats!: StatsSystem;
  combat!: CombatSystem;
  ai!: AISystem;
  saves = new SaveSystem();

  private renderer!: WorldRenderer;
  private ui!: GameUI;
  private selectedUnitId: string | null = null;
  private selectedTile: TileState | null = null;
  private skillTargeting = false;

  constructor(viewport: HTMLElement) {
    this.claimInitialTerritory();
    this.bindSystems();
    for (let i = 0; i < 18; i++) this.pokemon.spawnWildPokemon();
    this.renderer = new WorldRenderer(viewport, this.state, this.events);
    this.ui = new GameUI(this.state, this.events);
    this.bindEvents();
    this.emitState();
  }

  private claimInitialTerritory(): void {
    for (const city of this.state.cities) {
      for (const tile of this.state.tiles) if (hexDistance(tile, city) <= 1) tile.owner = city.owner;
    }
  }

  private bindSystems(): void {
    this.stats = new StatsSystem(this.state);
    this.cities = new CitySystem(this.state);
    this.heroes = new HeroSystem(this.state);
    this.artifacts = new ArtifactSystem(this.state);
    this.pokemon = new PokemonSystem(this.state);
    this.movement = new MovementSystem(this.state);
    this.combat = new CombatSystem(this.state, this.stats, this.pokemon);
    this.turns = new TurnSystem(this.state, this.events, this.stats);
    this.ai = new AISystem(this.state, this.movement, this.combat);
  }

  private bindEvents(): void {
    this.events.on<TileState>("tile:selected", tile => this.handleTileSelected(tile));
    this.events.on("command:found-city", () => this.foundCity());
    this.events.on<string>("command:recruit-hero", id => this.recruitHero(id));
    this.events.on("command:roll-artifact", () => this.rollArtifact());
    this.events.on<string>("command:choose-artifact", id => this.chooseArtifact(id));
    this.events.on<string>("command:equip-artifact", id => this.equipArtifact(id));
    this.events.on<string>("command:bind-pokemon", id => this.bindPokemon(id));
    this.events.on("command:attack-target", () => this.attackTarget());
    this.events.on("command:attack-wild", () => this.attackWild());
    this.events.on("command:hero-skill", () => this.heroSkill());
    this.events.on("command:begin-skill-target", () => this.beginSkillTarget());
    this.events.on("command:capture-pokemon", () => this.capturePokemon());
    this.events.on<ProductionId>("command:set-production", item => this.setProduction(item));
    this.events.on("command:buy-pokeballs", () => this.buyPokeballs());
    this.events.on("command:end-turn", () => this.endTurn());
    this.events.on("command:save", () => this.save());
    this.events.on("command:load", () => this.load());
  }

  private handleTileSelected(tile: TileState): void {
    if (this.skillTargeting) {
      this.selectedTile = tile;
      this.skillTargeting = false;
      this.heroSkill();
      return;
    }

    const friendlyUnit = this.unitAt(tile)?.owner === "player" ? this.unitAt(tile) : undefined;
    if (friendlyUnit) {
      this.selectedUnitId = friendlyUnit.id;
      this.selectedTile = tile;
      this.emitSelection();
      return;
    }

    const selected = this.getSelectedUnit();
    const enemyUnit = this.unitAt(tile)?.owner !== "player" ? this.unitAt(tile) : undefined;
    const anyCity = this.cityAt(tile);

    if (selected && (enemyUnit || (anyCity && anyCity.owner !== selected.owner) || tile.pokemonSpawnId)) {
      this.selectedTile = tile;
      this.emitSelection();
      return;
    }

    if (anyCity?.owner === "player") {
      this.selectedUnitId = null;
      this.selectedTile = tile;
      this.emitSelection();
      return;
    }

    if (selected && this.movement.moveTo(selected, tile)) {
      this.selectedTile = tile;
      this.emitState();
      this.emitSelection();
      return;
    }

    this.selectedTile = tile;
    this.selectedUnitId = null;
    this.emitSelection();
  }

  private foundCity(): void {
    const unit = this.getSelectedUnit();
    if (!unit) return;
    const city = this.cities.foundCity(unit, this.state.cities.some(c => c.owner === "player") ? `新城${this.state.cities.filter(c => c.owner === "player").length + 1}` : "曙光城");
    if (!city) return this.toast("这里不能建城：检查地形与城市间距。");
    this.selectedUnitId = null;
    this.selectedTile = this.tileAt(city.q, city.r) ?? null;
    this.toast(`建立城市：${city.name}`);
    this.emitState(); this.emitSelection();
  }

  private recruitHero(heroId: string): void {
    const city = this.getSelectedCity();
    if (!city || city.owner !== "player") return this.toast("请先选择自己的城市。");
    const spawn = this.state.tiles
      .filter(t => hexDistance(t, city) <= 1)
      .find(t => this.movement.canEnter({ id: "probe", owner: "player", type: "warrior", q: city.q, r: city.r, hp: 1, movement: 1 }, t));
    if (!spawn) return this.toast("城市周围没有可部署位置。");
    const hero = this.heroes.recruit(heroId, spawn.q, spawn.r);
    if (!hero) return this.toast("英雄招募失败：金币不足或英雄不可用。");
    this.toast(`英雄 ${this.stats.hero(hero)?.name ?? heroId} 加入文明。`);
    this.selectedUnitId = hero.id; this.selectedTile = spawn;
    this.emitState(); this.emitSelection();
  }

  private rollArtifact(): void {
    const city = this.getSelectedCity();
    if (!city || city.owner !== "player") return this.toast("需要在自己的城市开启神器宝箱。");
    if (this.state.gold < 40) return this.toast("需要 40 金币开启神器宝箱。");
    this.state.gold -= 40;
    this.events.emit("artifact:choices", this.artifacts.rollChoices(3));
    this.emitState(false);
  }

  private chooseArtifact(id: string): void {
    this.artifacts.grant(id);
    this.events.emit("artifact:choices", []);
    this.toast("神器已收入仓库。");
    this.emitState(false); this.emitSelection();
  }

  private equipArtifact(id: string): void {
    const hero = this.getSelectedUnit();
    if (!hero || hero.type !== "hero") return this.toast("请先选择一个英雄。");
    const beforeMax = this.stats.maxHp(hero);
    if (!this.artifacts.equip(hero, id)) return this.toast("神器装备失败，可能已经装备 3 件。");
    const afterMax = this.stats.maxHp(hero);
    if (afterMax > beforeMax) hero.hp += afterMax - beforeMax;
    this.toast("神器装备完成。");
    this.emitState(); this.emitSelection();
  }

  private bindPokemon(id: string): void {
    const hero = this.getSelectedUnit();
    if (!hero || hero.type !== "hero") return this.toast("请先选择英雄。");
    const beforeMax = this.stats.maxHp(hero);
    if (!this.pokemon.bindPartner(hero, id)) return this.toast("该精灵没有空闲个体可绑定。");
    const afterMax = this.stats.maxHp(hero);
    if (afterMax > beforeMax) hero.hp += afterMax - beforeMax;
    this.toast(`伙伴绑定：${this.pokemon.definition(id)?.name ?? id}`);
    this.emitState(); this.emitSelection();
  }

  private attackTarget(): void {
    const attacker = this.getSelectedUnit();
    const tile = this.selectedTile;
    if (!attacker || !tile) return;
    const enemy = this.unitAt(tile);
    const city = this.cityAt(tile);
    const ok = enemy && enemy.owner !== attacker.owner
      ? this.combat.attackUnit(attacker, enemy)
      : city && city.owner !== attacker.owner
        ? this.combat.attackCity(attacker, city.id)
        : false;
    if (!ok) return this.toast("目标不在近战范围内或本回合无法攻击。");
    this.cleanupDead(); this.toast("攻击结算完成。");
    this.emitState(); this.emitSelection();
  }

  private attackWild(): void {
    const attacker = this.getSelectedUnit();
    if (!attacker || !this.selectedTile?.pokemonSpawnId) return;
    if (!this.combat.attackWild(attacker, this.selectedTile)) return this.toast("必须在相邻格且拥有行动力。 ");
    this.cleanupDead();
    this.toast(this.selectedTile.pokemonSpawnId ? "野生精灵被削弱，捕获率提高。" : "野生精灵被击倒，无法捕获。 ");
    this.emitState(); this.emitSelection();
  }

  private beginSkillTarget(): void {
    const hero = this.getSelectedUnit();
    if (!hero || hero.type !== "hero") return this.toast("请先选择英雄。 ");
    if (hero.skillUsed) return this.toast("本回合技能已经使用。 ");
    this.skillTargeting = true;
    this.toast(`技能瞄准：${this.stats.hero(hero)?.skill.name ?? "英雄技能"}，点击地图目标格。`);
  }

  private heroSkill(): void {
    const hero = this.getSelectedUnit();
    if (!hero || hero.type !== "hero" || !this.selectedTile) return this.toast("先选择英雄，再选择技能目标格。 ");
    if (!this.combat.useHeroSkill(hero, this.selectedTile)) return this.toast("技能无法对当前目标使用：检查射程、目标与本回合技能状态。 ");
    this.cleanupDead(); this.toast(`${this.stats.hero(hero)?.skill.name ?? "英雄技能"} 已发动。`);
    this.emitState(); this.emitSelection();
  }

  private capturePokemon(): void {
    const actor = this.getSelectedUnit();
    if (!actor || !this.selectedTile?.pokemonSpawnId) return this.toast("先选择相邻的己方单位与野生精灵。 ");
    const result = this.pokemon.capture(this.selectedTile, actor);
    if (result.chance === 0) return this.toast("无法捕获：距离过远或没有精灵球。 ");
    this.toast(result.success ? `捕获成功：${result.name}` : `捕获失败，成功率约 ${Math.round(result.chance * 100)}%。`);
    this.emitState(); this.emitSelection();
  }

  private setProduction(item: ProductionId): void {
    const city = this.getSelectedCity();
    if (!city || city.owner !== "player") return;
    this.cities.setProduction(city, item);
    this.toast(`生产项目已切换：${item === "warrior" ? "战士" : "开拓者"}`);
    this.emitState(false); this.emitSelection();
  }

  private buyPokeballs(): void {
    if (this.state.gold < 15) return this.toast("金币不足，需要 15 金币。 ");
    this.state.gold -= 15; this.state.pokeballs += 3;
    this.toast("购买 3 个精灵球。 "); this.emitState(false);
  }

  private endTurn(): void {
    for (const city of this.state.cities.filter(c => c.hp > 0)) {
      const result = this.cities.processTurn(city);
      if (city.owner === "player" && result.grew) this.toast(`${city.name} 人口增长到 ${city.population}。`);
      if (city.owner === "player" && result.completed) this.toast(`${city.name} 完成生产：${result.completed === "warrior" ? "战士" : "开拓者"}。`);
    }
    this.ai.run();
    this.cleanupDead();
    this.turns.advance();
    if (Math.random() < 0.82) this.pokemon.spawnWildPokemon();
    this.selectedUnitId = null; this.selectedTile = null;
    this.emitState(); this.emitSelection();
  }

  private save(): void { this.saves.save(this.state); this.toast("已保存到浏览器本地存档。 "); }

  private load(): void {
    const loaded = this.saves.load();
    if (!loaded) return this.toast("没有可读取的存档。 ");
    this.state = loaded; this.selectedUnitId = null; this.selectedTile = null; this.skillTargeting = false;
    this.bindSystems(); this.renderer.setState(this.state); this.ui.setState(this.state);
    this.emitState(); this.emitSelection(); this.toast("存档已读取。 ");
  }

  private cleanupDead(): void { this.state.units = this.state.units.filter(u => u.hp > 0); }
  private getSelectedUnit(): UnitState | undefined { return this.selectedUnitId ? this.state.units.find(u => u.id === this.selectedUnitId) : undefined; }
  private getSelectedCity(): CityState | undefined { return this.selectedTile ? this.cityAt(this.selectedTile) : undefined; }
  private unitAt(tile: TileState): UnitState | undefined { return this.state.units.find(u => u.hp > 0 && u.q === tile.q && u.r === tile.r); }
  private cityAt(tile: TileState): CityState | undefined { return this.state.cities.find(c => c.hp > 0 && c.q === tile.q && c.r === tile.r); }
  private tileAt(q: number, r: number): TileState | undefined { return this.state.tiles.find(t => t.q === q && t.r === r); }
  private toast(message: string): void { this.events.emit("toast", message.trim()); }

  private emitSelection(): void {
    const unit = this.getSelectedUnit();
    this.events.emit("selection:changed", {
      tile: this.selectedTile,
      unit,
      city: this.selectedTile ? this.cityAt(this.selectedTile) ?? null : null,
      targetUnit: this.selectedTile ? this.unitAt(this.selectedTile) ?? null : null,
      reachable: unit ? this.movement.getReachable(unit) : []
    });
  }

  private emitState(rebuild = true): void {
    this.events.emit("state:changed", this.state);
    if (rebuild) this.renderer?.rebuild();
  }
}
