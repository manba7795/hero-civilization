import type { Axial } from "../map/Hex";

export type TerrainId = "grass" | "plains" | "desert" | "coast" | "ocean";
export type Elevation = "flat" | "hill" | "mountain";
export type FeatureId = "forest" | "rainforest" | "marsh" | null;
export type UnitType = "settler" | "warrior" | "hero";
export type ProductionId = "warrior" | "settler";

export interface TileState extends Axial {
  terrain: TerrainId;
  elevation: Elevation;
  feature: FeatureId;
  resource: string | null;
  owner: string | null;
  riverEdges: boolean[];
  roadEdges: boolean[];
  pokemonSpawnId: string | null;
  pokemonHp: number | null;
  pokemonMaxHp: number | null;
  discovered: boolean;
}

export interface CityState extends Axial {
  id: string;
  owner: string;
  name: string;
  population: number;
  hp: number;
  food: number;
  production: number;
  productionQueue: ProductionId[];
  buildings?: string[];
  workedTiles?: string[];
}

export interface UnitState extends Axial {
  id: string;
  owner: string;
  type: UnitType;
  hp: number;
  movement: number;
  heroId?: string;
  artifactIds?: string[];
  pokemonPartnerId?: string;
  skillUsed?: boolean;
  mirrorUsed?: boolean;
  empoweredAttack?: number;
}

export interface GameState {
  version: number;
  turn: number;
  activePlayer: string;
  nationId: string;
  leaderId: string;
  gold: number;
  science: number;
  culture: number;
  pokeballs: number;
  tiles: TileState[];
  cities: CityState[];
  units: UnitState[];
  capturedPokemon: string[];
  legendaryPokemon: string[];
  artifactInventory: string[];
  researchedTechs: string[];
  researchedCivics?: string[];
}

export interface YieldBundle {
  food: number;
  production: number;
  gold: number;
  science: number;
  culture: number;
}
