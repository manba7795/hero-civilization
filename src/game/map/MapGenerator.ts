import type { TileState, TerrainId, Elevation, FeatureId } from "../state/types";

function noise(q: number, r: number, seed: number): number {
  const x = Math.sin(q * 12.9898 + r * 78.233 + seed * 0.1337) * 43758.5453;
  return x - Math.floor(x);
}

function smoothNoise(q: number, r: number, seed: number): number {
  const a = Math.sin((q + seed * 0.01) * 0.47);
  const b = Math.cos((r - seed * 0.02) * 0.51);
  const c = Math.sin((q + r) * 0.21 + seed * 0.001);
  return (a + b + c + 3) / 6;
}

export function generateMap(width = 24, height = 16, seed = 48621): TileState[] {
  const tiles: TileState[] = [];
  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      const edge = Math.min(q, r, width - q - 1, height - r - 1);
      let heightValue = smoothNoise(q, r, seed) * 0.78 + noise(q, r, seed + 1) * 0.22;
      const moisture = smoothNoise(q + 17, r - 11, seed + 301);
      if (edge === 0) heightValue -= 0.28;
      else if (edge === 1) heightValue -= 0.10;

      let terrain: TerrainId = "plains";
      let elevation: Elevation = "flat";
      let feature: FeatureId = null;

      if (heightValue < 0.28) terrain = "ocean";
      else if (heightValue < 0.36) terrain = "coast";
      else if (moisture < 0.30) terrain = "desert";
      else if (moisture > 0.58) terrain = "grass";

      if (terrain !== "ocean" && terrain !== "coast") {
        if (heightValue > 0.78) elevation = "mountain";
        else if (heightValue > 0.65) elevation = "hill";
        if (elevation !== "mountain" && moisture > 0.64) feature = "forest";
      }

      const roll = noise(q * 3, r * 5, seed + 991);
      let resource: string | null = null;
      if (terrain !== "ocean" && elevation !== "mountain" && roll > 0.93) {
        resource = roll > 0.985 ? "iron" : roll > 0.965 ? "horse" : "wheat";
      }
      if (roll > 0.997) resource = "crystal";

      tiles.push({ q, r, terrain, elevation, feature, resource, owner: null,
        riverEdges: [false,false,false,false,false,false],
        roadEdges: [false,false,false,false,false,false],
        pokemonSpawnId: null, pokemonHp: null, pokemonMaxHp: null,
        discovered: true });
    }
  }
  return tiles;
}
