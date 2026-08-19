import type { CityState, GameState, TileState, UnitState } from "../game/state/types";
import type { EventBus } from "../core/EventBus";
import { hexDistance } from "../game/map/Hex";
import { StatsSystem } from "../game/systems/StatsSystem";
import { CitySystem } from "../game/systems/CitySystem";
import nations from "../data/nations.json";
import leaders from "../data/leaders.json";
import heroes from "../data/heroes.json";
import artifacts from "../data/artifacts.json";
import pokemon from "../data/pokemon.json";

type Selection = {
  tile: TileState | null;
  unit?: UnitState;
  city?: CityState | null;
  targetUnit?: UnitState | null;
  reachable?: Array<{ tile: TileState; cost: number }>;
};

export class GameUI {
  private resources = document.querySelector<HTMLDivElement>("#resources")!;
  private selection = document.querySelector<HTMLDivElement>("#selection")!;
  private nationPanel = document.querySelector<HTMLDivElement>("#nation-panel")!;
  private heroPanel = document.querySelector<HTMLDivElement>("#hero-panel")!;
  private pokemonPanel = document.querySelector<HTMLDivElement>("#pokemon-panel")!;
  private selectionState: Selection = { tile: null };
  private artifactChoices: any[] = [];
  private stats: StatsSystem;
  private cities: CitySystem;

  constructor(private state: GameState, private events: EventBus) {
    this.stats = new StatsSystem(state);
    this.cities = new CitySystem(state);
    events.on<Selection>("selection:changed", selection => { this.selectionState = selection; this.renderSelection(); });
    events.on("state:changed", () => this.render());
    events.on<any[]>("artifact:choices", choices => { this.artifactChoices = choices; this.renderSelection(); });
    events.on<string>("toast", message => this.toast(message));
    this.render();
  }

  setState(state: GameState): void {
    this.state = state;
    this.stats = new StatsSystem(state);
    this.cities = new CitySystem(state);
    this.selectionState = { tile: null };
    this.render();
  }

  render(): void {
    const playerCities = this.state.cities.filter(c => c.owner === "player" && c.hp > 0);
    const income = playerCities.reduce((sum, city) => {
      const y = this.cities.getYield(city);
      sum.gold += y.gold; sum.science += y.science; sum.culture += y.culture;
      return sum;
    }, { gold: 0, science: 0, culture: 0 });
    this.resources.textContent = `第 ${this.state.turn} 回合　💰 ${this.state.gold} (+${income.gold})　🔬 ${this.state.science} (+${income.science})　🎭 ${this.state.culture} (+${income.culture})　🔴 ${this.state.pokeballs}`;

    const nation = (nations as any[]).find(x => x.id === this.state.nationId);
    const leader = (leaders as any[]).find(x => x.id === this.state.leaderId);
    this.nationPanel.innerHTML = `
      <div class="panel">
        <strong>${nation?.name ?? this.state.nationId}</strong>
        <div class="muted">固定领袖：${leader?.name ?? this.state.leaderId}</div>
        <div class="muted">${leader?.trait ?? ""}</div>
        <div class="row"><button id="save-game">保存</button><button id="load-game">读取</button></div>
      </div>`;
    this.nationPanel.querySelector<HTMLButtonElement>("#save-game")!.onclick = () => this.events.emit("command:save", undefined);
    this.nationPanel.querySelector<HTMLButtonElement>("#load-game")!.onclick = () => this.events.emit("command:load", undefined);

    const heroDefs = heroes as any[];
    const recruited = new Set(this.state.units.filter(u => u.heroId && u.hp > 0).map(u => u.heroId));
    this.heroPanel.innerHTML = `
      <div class="panel"><strong>英雄招募池</strong>
        <div class="muted">先选择自己的城市。国家领袖固定，英雄可以自由招募。</div>
        ${heroDefs.filter(h => !recruited.has(h.id)).slice(0, 7).map(h => `<button class="wide hero-recruit" data-id="${h.id}">${h.name} · ${h.role} · ${h.cost}💰<span>HP ${h.hp} / 攻击 ${h.attack} / 技能 ${h.skill.name}</span></button>`).join("") || '<div class="muted">英雄池已招募完。</div>'}
      </div>`;
    this.heroPanel.querySelectorAll<HTMLButtonElement>(".hero-recruit").forEach(btn => btn.onclick = () => this.events.emit("command:recruit-hero", btn.dataset.id!));

    const pokeDefs = pokemon as any[];
    const counts = new Map<string, number>();
    this.state.capturedPokemon.forEach(id => counts.set(id, (counts.get(id) ?? 0) + 1));
    const selectedHero = this.selectionState.unit?.type === "hero" ? this.selectionState.unit : null;
    this.pokemonPanel.innerHTML = `
      <div class="panel"><strong>精灵仓库</strong>
        <div class="row"><button id="buy-balls">购买 3 球 · 15💰</button></div>
        ${counts.size ? [...counts.entries()].map(([id, count]) => {
          const p = pokeDefs.find(x => x.id === id);
          return `<div class="inventory-line"><span><b>${p?.name ?? id}</b> ×${count}<small>${p?.partnerBonus ?? ""}</small></span>${selectedHero ? `<button class="bind-pokemon" data-id="${id}">绑定</button>` : ""}</div>`;
        }).join("") : '<div class="muted">尚未捕获。野生精灵会按地形生态刷新。</div>'}
      </div>`;
    this.pokemonPanel.querySelector<HTMLButtonElement>("#buy-balls")!.onclick = () => this.events.emit("command:buy-pokeballs", undefined);
    this.pokemonPanel.querySelectorAll<HTMLButtonElement>(".bind-pokemon").forEach(btn => btn.onclick = () => this.events.emit("command:bind-pokemon", btn.dataset.id!));
    this.renderSelection();
  }

  private renderSelection(): void {
    const { tile, unit, city, targetUnit } = this.selectionState;
    if (!tile) {
      this.selection.innerHTML = '<div class="panel muted">点击地图单位或城市。选择己方单位后，蓝色六角为本回合可达范围。</div>';
      return;
    }

    const heroDef = unit?.heroId ? (heroes as any[]).find(h => h.id === unit.heroId) : null;
    const targetHeroDef = targetUnit?.heroId ? (heroes as any[]).find(h => h.id === targetUnit.heroId) : null;
    const pokeDef = tile.pokemonSpawnId ? (pokemon as any[]).find(p => p.id === tile.pokemonSpawnId) : null;
    const equipped = unit?.artifactIds?.map(id => (artifacts as any[]).find(a => a.id === id)?.name ?? id) ?? [];
    const partner = unit?.pokemonPartnerId ? (pokemon as any[]).find(p => p.id === unit.pokemonPartnerId) : null;
    const actions: string[] = [];

    if (unit?.type === "settler" && unit.q === tile.q && unit.r === tile.r) actions.push('<button id="found-city" class="wide">建立城市</button>');
    if (unit?.type === "hero") actions.push(`<button id="begin-skill" class="wide" ${unit.skillUsed ? "disabled" : ""}>技能瞄准 · ${heroDef?.skill.name ?? "技能"}</button>`);

    const enemyTarget = targetUnit && unit && targetUnit.id !== unit.id && targetUnit.owner !== unit.owner;
    const enemyCity = city && unit && city.owner !== unit.owner;
    if (enemyTarget || enemyCity) {
      const d = unit ? hexDistance(unit, tile) : 99;
      actions.push(`<button id="attack-target" class="wide">近战攻击当前目标 · 距离 ${d}</button>`);
      if (unit?.type === "hero") actions.push(`<button id="hero-skill" class="wide" ${unit.skillUsed ? "disabled" : ""}>对当前目标施放 ${heroDef?.skill.name ?? "技能"}</button>`);
    }

    if (pokeDef && unit) {
      const hp = tile.pokemonHp ?? pokeDef.hp;
      const maxHp = tile.pokemonMaxHp ?? pokeDef.hp;
      const weakened = 1 - hp / Math.max(1, maxHp);
      const chance = Math.max(0.08, Math.min(0.90, 0.34 + weakened * 0.52 - pokeDef.rarity * 0.055));
      actions.push('<button id="attack-wild" class="wide">战斗削弱野生精灵</button>');
      actions.push(`<button id="capture-pokemon" class="wide">精灵球捕获 · 约 ${Math.round(chance * 100)}%</button>`);
      if (unit.type === "hero") actions.push(`<button id="hero-skill" class="wide" ${unit.skillUsed ? "disabled" : ""}>使用 ${heroDef?.skill.name ?? "技能"} 削弱</button>`);
    }

    if (city?.owner === "player" && !unit) {
      const y = this.cities.getYield(city);
      const current = city.productionQueue[0];
      const cost = this.cities.productionCost(current);
      actions.push('<button class="wide set-production" data-item="warrior">生产战士 · 28⚒</button>');
      actions.push('<button class="wide set-production" data-item="settler">生产开拓者 · 46⚒</button>');
      actions.push('<button id="roll-artifact" class="wide">神器宝箱 · 40💰</button>');
      actions.push(`<div class="economy-box">本回合产出：🍞 ${y.food}　⚒ ${y.production}　💰 ${y.gold}　🔬 ${y.science}　🎭 ${y.culture}<br>当前生产：${current === "settler" ? "开拓者" : "战士"} ${Math.floor(city.production)}/${cost}</div>`);
    }

    if (this.artifactChoices.length) {
      actions.push(`<div class="artifact-choice"><strong>神器三选一</strong>${this.artifactChoices.map(a => `<button class="wide artifact-grant" data-id="${a.id}">${a.name}<span>${a.description}</span></button>`).join("")}</div>`);
    }

    if (unit?.type === "hero" && this.state.artifactInventory.length) {
      actions.push(`<div class="artifact-choice"><strong>神器仓库 · ${equipped.length}/3</strong>${this.state.artifactInventory.map(id => {
        const a = (artifacts as any[]).find(x => x.id === id);
        return `<button class="wide equip-artifact" data-id="${id}">装备 ${a?.name ?? id}<span>${a?.description ?? ""}</span></button>`;
      }).join("")}</div>`);
    }

    const actorCard = unit ? `<hr><strong>${heroDef?.name ?? (unit.type === "settler" ? "开拓者" : "战士")}</strong>
      <div class="muted">HP ${Math.max(0, Math.round(unit.hp))}/${this.stats.maxHp(unit)} · 攻击 ${this.stats.attack(unit)} · 移动 ${unit.movement}/${this.stats.maxMovement(unit)}
      ${unit.type === "hero" ? `<br>技能：${heroDef?.skill.name} · 威力 ${this.stats.skillPower(unit)} · 射程 ${this.stats.skillRange(unit)}${unit.skillUsed ? " · 本回合已用" : ""}` : ""}
      ${equipped.length ? `<br>神器：${equipped.join(" / ")}` : ""}${partner ? `<br>伙伴：${partner.name}（${partner.partnerBonus}）` : ""}</div>` : "";

    const targetCard = enemyTarget ? `<hr><strong class="danger">敌方 ${targetHeroDef?.name ?? (targetUnit?.type === "warrior" ? "战士" : "单位")}</strong><div class="muted">HP ${Math.max(0, Math.round(targetUnit!.hp))}</div>` : "";
    const cityCard = city ? `<hr><strong>${city.owner === "player" ? "🏛" : "⚔"} ${city.name}</strong><div class="muted">人口 ${city.population} · 城防 ${Math.max(0, Math.round(city.hp))}/120 · 粮仓 ${Math.floor(city.food)}</div>` : "";
    const wildCard = pokeDef ? `<hr><strong>野生 ${pokeDef.name}</strong><div class="muted">${"★".repeat(pokeDef.rarity)} · HP ${Math.max(0, Math.round(tile.pokemonHp ?? pokeDef.hp))}/${tile.pokemonMaxHp ?? pokeDef.hp}<br>伙伴效果：${pokeDef.partnerBonus}</div>` : "";

    this.selection.innerHTML = `
      <div class="panel">
        <strong>Hex ${tile.q}, ${tile.r}</strong>
        <div class="muted">地形：${tile.terrain} · 高程：${tile.elevation} · 地貌：${tile.feature ?? "无"}<br>资源：${tile.resource ?? "无"} · 领土：${tile.owner ?? "无主"}</div>
        ${actorCard}${targetCard}${cityCard}${wildCard}
        <div class="actions">${actions.join("") || '<span class="muted">无可用操作。</span>'}</div>
      </div>`;

    this.selection.querySelector<HTMLButtonElement>("#found-city")?.addEventListener("click", () => this.events.emit("command:found-city", undefined));
    this.selection.querySelector<HTMLButtonElement>("#begin-skill")?.addEventListener("click", () => this.events.emit("command:begin-skill-target", undefined));
    this.selection.querySelector<HTMLButtonElement>("#attack-target")?.addEventListener("click", () => this.events.emit("command:attack-target", undefined));
    this.selection.querySelectorAll<HTMLButtonElement>("#hero-skill").forEach(btn => btn.onclick = () => this.events.emit("command:hero-skill", undefined));
    this.selection.querySelector<HTMLButtonElement>("#attack-wild")?.addEventListener("click", () => this.events.emit("command:attack-wild", undefined));
    this.selection.querySelector<HTMLButtonElement>("#capture-pokemon")?.addEventListener("click", () => this.events.emit("command:capture-pokemon", undefined));
    this.selection.querySelector<HTMLButtonElement>("#roll-artifact")?.addEventListener("click", () => this.events.emit("command:roll-artifact", undefined));
    this.selection.querySelectorAll<HTMLButtonElement>(".set-production").forEach(btn => btn.onclick = () => this.events.emit("command:set-production", btn.dataset.item));
    this.selection.querySelectorAll<HTMLButtonElement>(".artifact-grant").forEach(btn => btn.onclick = () => this.events.emit("command:choose-artifact", btn.dataset.id!));
    this.selection.querySelectorAll<HTMLButtonElement>(".equip-artifact").forEach(btn => btn.onclick = () => this.events.emit("command:equip-artifact", btn.dataset.id!));
  }

  private toast(message: string): void {
    let el = document.querySelector<HTMLDivElement>("#toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
    el.textContent = message; el.classList.add("show");
    window.setTimeout(() => el?.classList.remove("show"), 2100);
  }
}
