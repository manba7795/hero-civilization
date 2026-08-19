import type { GameState, TileState } from "./types";
import { generateMap } from "../map/MapGenerator";

function normalizeStart(tiles: TileState[], q0: number, r0: number): void {
  for (const tile of tiles) {
    const dq = tile.q - q0, dr = tile.r - r0;
    const distance = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(-dq - dr));
    if (distance <= 1) {
      tile.terrain = distance === 0 ? "plains" : tile.terrain === "ocean" ? "grass" : tile.terrain;
      tile.elevation = "flat";
      if (distance === 0) tile.feature = null;
    }
  }
}

export function createInitialState(): GameState {
  const tiles = generateMap();
  normalizeStart(tiles, 4, 5);
  normalizeStart(tiles, 18, 10);

  return {
    version: 5,
    turn: 1,
    activePlayer: "player",
    nationId: "astral_republic",
    leaderId: "selerus",
    gold: 90,
    science: 0,
    culture: 0,
    pokeballs: 5,
    tiles,
    cities: [
      {
        id: "city_ai_capital", owner: "ai", name: "暮铁城", q: 18, r: 10,
        population: 2, hp: 120, food: 0, production: 0, productionQueue: ["warrior"]
      }
    ],
    units: [
      { id: "u_settler_1", owner: "player", type: "settler", q: 4, r: 5, hp: 100, movement: 2 },
      { id: "u_warrior_1", owner: "player", type: "warrior", q: 5, r: 5, hp: 100, movement: 2 },
      { id: "u_ai_warrior_1", owner: "ai", type: "warrior", q: 17, r: 10, hp: 100, movement: 2 }
    ],
    capturedPokemon: [],
    legendaryPokemon: [],
    artifactInventory: [],
    researchedTechs: []
  };
}
