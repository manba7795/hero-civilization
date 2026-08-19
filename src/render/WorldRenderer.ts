import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GameState, TileState, UnitState, CityState } from "../game/state/types";
import type { EventBus } from "../core/EventBus";

const TERRAIN_COLORS: Record<string, number> = {
  grass: 0x719c5b,
  plains: 0x9f9b60,
  desert: 0xc8aa6f,
  coast: 0x4388a0,
  ocean: 0x286b86
};

export class WorldRenderer {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  private renderer = new THREE.WebGLRenderer({ antialias: true });
  private controls: OrbitControls;
  private root = new THREE.Group();
  private overlay = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private tileMeshes = new Map<THREE.Object3D, TileState>();

  constructor(
    private mount: HTMLElement,
    private state: GameState,
    private events: EventBus
  ) {
    this.scene.background = new THREE.Color(0x0b1a24);
    this.scene.fog = new THREE.Fog(0x0b1a24, 28, 72);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.mount.appendChild(this.renderer.domElement);

    this.camera.position.set(18, 24, 26);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(14, 0, 10);
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.minPolarAngle = Math.PI * 0.18;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 52;

    this.scene.add(new THREE.HemisphereLight(0xd8efff, 0x37452b, 2.1));
    const sun = new THREE.DirectionalLight(0xffedc2, 3.2);
    sun.position.set(-16, 28, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(sun);

    this.scene.add(this.root);
    this.scene.add(this.overlay);
    this.addOceanPlane();
    this.rebuild();
    this.resize();

    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("resize", this.resize);
    this.events.on<any>("selection:changed", selection => this.renderSelection(selection?.tile ?? null, selection?.reachable ?? []));
    this.animate();
  }

  setState(state: GameState): void {
    this.state = state;
    this.rebuild();
  }

  rebuild(): void {
    this.disposeGroup(this.root);
    this.root.clear();
    this.tileMeshes.clear();

    for (const tile of this.state.tiles) {
      const tileObject = this.createTile(tile);
      this.root.add(tileObject);
      const city = this.state.cities.find(c => c.q === tile.q && c.r === tile.r && c.hp > 0);
      if (city) tileObject.add(this.createCity(city, tile));
      const unit = this.state.units.find(u => u.q === tile.q && u.r === tile.r && u.hp > 0);
      if (unit) tileObject.add(this.createUnit(unit, tile));
    }
  }

  private createTile(tile: TileState): THREE.Object3D {
    const group = new THREE.Group();
    const elevation = tile.elevation === "mountain" ? 1.4 : tile.elevation === "hill" ? 0.48 : 0.10;
    const radius = 0.99;
    const geometry = new THREE.CylinderGeometry(radius, radius, elevation, 6);
    const material = new THREE.MeshStandardMaterial({
      color: TERRAIN_COLORS[tile.terrain] ?? 0x777777,
      roughness: 0.96,
      metalness: 0.0
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.y = Math.PI / 6;
    mesh.position.y = elevation / 2;
    mesh.receiveShadow = true;
    mesh.castShadow = tile.elevation !== "flat";
    group.add(mesh);

    const x = Math.sqrt(3) * (tile.q + tile.r / 2);
    const z = 1.5 * tile.r;
    group.position.set(x, 0, z);
    group.userData.tile = tile;
    this.tileMeshes.set(mesh, tile);

    if (tile.owner) this.addTerritoryOverlay(group, tile.owner, elevation);
    if (tile.feature === "forest") this.addForest(group, tile, elevation);
    if (tile.elevation === "mountain") this.addMountain(group, elevation);
    if (tile.pokemonSpawnId) this.addPokemonMarker(group, elevation);
    if (tile.resource) this.addResourceMarker(group, tile.resource, elevation);

    return group;
  }

  private addTerritoryOverlay(group: THREE.Group, owner: string, elevation: number): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 0.96, 6),
      new THREE.MeshBasicMaterial({
        color: owner === "player" ? 0x69c7e7 : 0xe16d71,
        side: THREE.DoubleSide, transparent: true, opacity: 0.42, depthWrite: false
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.rotation.z = Math.PI / 6;
    ring.position.y = elevation + 0.018;
    group.add(ring);
  }

  private addOceanPlane(): void {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 60),
      new THREE.MeshStandardMaterial({ color: 0x1b5f7a, roughness: 0.35, metalness: 0.05, transparent: true, opacity: 0.75 })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(16, -0.05, 12);
    plane.receiveShadow = true;
    this.scene.add(plane);
  }

  private addForest(group: THREE.Group, tile: TileState, elevation: number): void {
    for (let i = 0; i < 5; i++) {
      const tree = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.72, 7),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0x2e633f : 0x3f754b, roughness: 1 })
      );
      const a = (i / 5) * Math.PI * 2 + tile.q * 0.31 + tile.r * 0.12;
      tree.position.set(Math.cos(a) * 0.42, elevation + 0.34, Math.sin(a) * 0.42);
      tree.castShadow = true;
      group.add(tree);
    }
  }

  private addMountain(group: THREE.Group, elevation: number): void {
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(0.68, 2.05, 6),
      new THREE.MeshStandardMaterial({ color: 0x7d807b, roughness: 1 })
    );
    mountain.position.y = elevation + 0.92;
    mountain.castShadow = true;
    group.add(mountain);

    const snow = new THREE.Mesh(
      new THREE.ConeGeometry(0.26, 0.55, 6),
      new THREE.MeshStandardMaterial({ color: 0xf1f2ec, roughness: 0.9 })
    );
    snow.position.y = elevation + 1.78;
    group.add(snow);
  }

  private addPokemonMarker(group: THREE.Group, elevation: number): void {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 20, 20),
      new THREE.MeshStandardMaterial({ color: 0xffd95a, emissive: 0x493300, emissiveIntensity: 0.7 })
    );
    marker.position.y = elevation + 0.5;
    group.add(marker);
  }

  private addResourceMarker(group: THREE.Group, resource: string, elevation: number): void {
    const color = resource === "iron" ? 0x8fa0ac : 0xd7c070;
    const marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.13),
      new THREE.MeshStandardMaterial({ color, metalness: resource === "iron" ? 0.65 : 0.0, roughness: 0.5 })
    );
    marker.position.set(0.45, elevation + 0.28, 0.2);
    group.add(marker);
  }

  private createCity(city: CityState, tile: TileState): THREE.Group {
    const group = new THREE.Group();
    const elevation = tile.elevation === "mountain" ? 1.4 : tile.elevation === "hill" ? 0.48 : 0.10;
    group.position.y = elevation;
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.62, 0.34, 6),
      new THREE.MeshStandardMaterial({ color: city.owner === "player" ? 0xd2b36b : 0x9c6766, roughness: 0.9 })
    );
    wall.position.y = 0.42;
    wall.castShadow = true;
    group.add(wall);

    for (let i = 0; i < 3; i++) {
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.14, 0.56 + i * 0.06, 6),
        new THREE.MeshStandardMaterial({ color: 0xe4cf99, roughness: 0.95 })
      );
      tower.position.set((i - 1) * 0.28, 0.62 + i * 0.03, i === 1 ? -0.08 : 0.08);
      tower.castShadow = true;
      group.add(tower);
    }
    this.addHealthBar(group, Math.max(0, city.hp) / 120, 1.08);
    return group;
  }

  private createUnit(unit: UnitState, tile: TileState): THREE.Group {
    const group = new THREE.Group();
    const elevation = tile.elevation === "mountain" ? 1.4 : tile.elevation === "hill" ? 0.48 : 0.10;
    group.position.y = elevation;
    const player = unit.owner === "player";
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.3, 0.08, 24),
      new THREE.MeshStandardMaterial({ color: player ? 0x4faed1 : 0xd35b62, metalness: 0.15, roughness: 0.65 })
    );
    base.position.y = 0.2;
    group.add(base);

    if (unit.type === "hero") {
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.12, 0.35, 6, 12),
        new THREE.MeshStandardMaterial({ color: 0xe1bd58, roughness: 0.6 })
      );
      body.position.y = 0.52;
      body.castShadow = true;
      group.add(body);
    } else if (unit.type === "settler") {
      const wagon = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.22, 0.30),
        new THREE.MeshStandardMaterial({ color: 0xd2ba85, roughness: 0.95 })
      );
      wagon.position.y = 0.38;
      wagon.castShadow = true;
      group.add(wagon);
    } else {
      const soldier = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.11, 0.30, 5, 10),
        new THREE.MeshStandardMaterial({ color: 0xbcc7cc, roughness: 0.6 })
      );
      soldier.position.y = 0.46;
      soldier.castShadow = true;
      group.add(soldier);
    }
    const maxHp = unit.type === "hero" ? 160 : 100;
    this.addHealthBar(group, Math.max(0, unit.hp) / maxHp, 0.98);
    return group;
  }

  private addHealthBar(group: THREE.Group, ratio: number, y: number): void {
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.54, 0.055),
      new THREE.MeshBasicMaterial({ color: 0x321b1b, side: THREE.DoubleSide, depthWrite: false })
    );
    bg.rotation.x = -Math.PI / 2;
    bg.position.set(0, y, -0.28);
    group.add(bg);
    const width = 0.50 * Math.max(0, Math.min(1, ratio));
    const fg = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(0.01, width), 0.035),
      new THREE.MeshBasicMaterial({ color: ratio > 0.5 ? 0x76d582 : ratio > 0.25 ? 0xe0c45d : 0xe26f6f, side: THREE.DoubleSide, depthWrite: false })
    );
    fg.rotation.x = -Math.PI / 2;
    fg.position.set((width - 0.50) / 2, y + 0.006, -0.28);
    group.add(fg);
  }

  private renderSelection(tile: TileState | null, reachable: Array<{ tile: TileState; cost: number }>): void {
    this.disposeGroup(this.overlay);
    this.overlay.clear();

    for (const item of reachable) {
      const t = item.tile;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.78, 0.91, 6),
        new THREE.MeshBasicMaterial({ color: 0x66d2e5, side: THREE.DoubleSide, transparent: true, opacity: 0.34, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.rotation.z = Math.PI / 6;
      const y = t.elevation === "hill" ? 0.51 : 0.13;
      ring.position.set(Math.sqrt(3) * (t.q + t.r / 2), y, 1.5 * t.r);
      this.overlay.add(ring);
    }

    if (!tile) return;
    const selected = new THREE.Mesh(
      new THREE.RingGeometry(0.80, 0.99, 6),
      new THREE.MeshBasicMaterial({ color: 0xffdb6d, side: THREE.DoubleSide, transparent: true, opacity: 0.92, depthWrite: false })
    );
    selected.rotation.x = -Math.PI / 2;
    selected.rotation.z = Math.PI / 6;
    const y = tile.elevation === "mountain" ? 1.45 : tile.elevation === "hill" ? 0.51 : 0.13;
    selected.position.set(Math.sqrt(3) * (tile.q + tile.r / 2), y, 1.5 * tile.r);
    this.overlay.add(selected);
  }

  private onPointerDown = (event: PointerEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([...this.tileMeshes.keys()]);
    const tile = hits.length ? this.tileMeshes.get(hits[0].object) : undefined;
    if (tile) this.events.emit("tile:selected", tile);
  };

  private resize = (): void => {
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  };

  private animate = (): void => {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.animate);
  };

  private disposeGroup(group: THREE.Group): void {
    group.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach(m => m.dispose());
      else material?.dispose?.();
    });
  }
}
