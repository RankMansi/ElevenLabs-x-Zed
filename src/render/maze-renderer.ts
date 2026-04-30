import type { Maze, Point, RunId } from "../types/maze";
import { TILE_SIZE } from "../config/game";
import { getCell } from "../maze/grid";

export interface MazeRenderOptions {
  ctx: CanvasRenderingContext2D;
  maze: Maze;
  playerWorldPos: Point; // pixel position (centre of player)
  cameraOffset: Point; // world-space pixel offset so player is centred
  lightRadiusTiles: number;
  showGhostWalls: boolean;
  ghostWallAlpha: number;
  prevMaze?: Maze; // previous maze state for ghost-wall display
  /** When set while morphing, walls blend from this snapshot toward `maze`. */
  morphFrom?: Maze | null;
  /** 0…1; at 1 the morph is finished (collision already uses `maze`). */
  morphT?: number;
}

// ─── Colour constants (concrete / industrial — lifted from near-black so tiles stay legible) ─
const FLOOR_A = "#2e322e";
const FLOOR_B = "#2a2e2a";
const WALL_BASE = "#5c615c";
const WALL_HIGHLIGHT = "#787d78";
const WALL_SHADOW = "#454945";
const WALL_THICKNESS = 4; // px

// ─── Main entry ─────────────────────────────────────────────────────────────

/**
 * Draw all maze tiles (floor + walls + special cells) that fall within the
 * current light radius.  Ghost walls from the *previous* maze state are
 * rendered at low alpha so the player can briefly perceive the shift.
 */
export function renderMaze(opts: MazeRenderOptions): void {
  const {
    ctx,
    maze,
    playerWorldPos,
    cameraOffset,
    lightRadiusTiles,
    showGhostWalls,
    ghostWallAlpha,
    prevMaze,
    morphFrom,
    morphT = 1,
  } = opts;

  const morphing = Boolean(morphFrom && morphT < 1);
  const lightPx = lightRadiusTiles * TILE_SIZE;

  // Tile range that overlaps the light disc (with 1-tile margin)
  const minGX = Math.max(
    0,
    Math.floor((playerWorldPos.x - lightPx) / TILE_SIZE) - 1,
  );
  const maxGX = Math.min(
    maze.width - 1,
    Math.ceil((playerWorldPos.x + lightPx) / TILE_SIZE) + 1,
  );
  const minGY = Math.max(
    0,
    Math.floor((playerWorldPos.y - lightPx) / TILE_SIZE) - 1,
  );
  const maxGY = Math.min(
    maze.height - 1,
    Math.ceil((playerWorldPos.y + lightPx) / TILE_SIZE) + 1,
  );

  ctx.save();
  ctx.translate(-cameraOffset.x, -cameraOffset.y);

  // ── Pass 1: floors ────────────────────────────────────────────────────────
  for (let gy = minGY; gy <= maxGY; gy++) {
    for (let gx = minGX; gx <= maxGX; gx++) {
      if (!isInLightDisc(gx, gy, playerWorldPos, lightPx)) continue;
      const cell = getCell(maze, gx, gy);
      if (!cell) continue;
      drawFloor(ctx, gx, gy, cell.isStart, cell.isExit, cell.isDecoyExit);
    }
  }

  // ── Pass 2: walls (current maze or morph blend) ───────────────────────────
  if (morphing && morphFrom) {
    const u = cubicBezierEase01(morphT);
    for (let gy = minGY; gy <= maxGY; gy++) {
      for (let gx = minGX; gx <= maxGX; gx++) {
        if (!isInLightDisc(gx, gy, playerWorldPos, lightPx)) continue;
        const oldCell = getCell(morphFrom, gx, gy);
        const newCell = getCell(maze, gx, gy);
        if (!oldCell || !newCell) continue;
        drawCellWallsMorph(ctx, oldCell.walls, newCell.walls, gx, gy, u);
      }
    }
  } else {
    for (let gy = minGY; gy <= maxGY; gy++) {
      for (let gx = minGX; gx <= maxGX; gx++) {
        if (!isInLightDisc(gx, gy, playerWorldPos, lightPx)) continue;
        const cell = getCell(maze, gx, gy);
        if (!cell) continue;
        drawCellWalls(ctx, cell.walls, gx, gy, false, 1);
      }
    }
  }

  // ── Pass 3: ghost walls (prev state, faded) ───────────────────────────────
  if (!morphing && showGhostWalls && prevMaze && ghostWallAlpha > 0) {
    ctx.globalAlpha = ghostWallAlpha;
    for (let gy = minGY; gy <= maxGY; gy++) {
      for (let gx = minGX; gx <= maxGX; gx++) {
        if (!isInLightDisc(gx, gy, playerWorldPos, lightPx)) continue;
        const prevCell = getCell(prevMaze, gx, gy);
        const currCell = getCell(maze, gx, gy);
        if (!prevCell || !currCell) continue;

        // Only show walls that *existed* before but are now *gone*
        const diff = {
          north: prevCell.walls.north && !currCell.walls.north,
          east: prevCell.walls.east && !currCell.walls.east,
          south: prevCell.walls.south && !currCell.walls.south,
          west: prevCell.walls.west && !currCell.walls.west,
        };
        const hasDiff = diff.north || diff.east || diff.south || diff.west;
        if (hasDiff) drawCellWalls(ctx, diff, gx, gy, true, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

// ─── Player marker ───────────────────────────────────────────────────────────

/**
 * Draw the player dot + facing indicator, centred on the canvas
 * (camera-space, i.e. NOT offset — called AFTER ctx.restore()).
 */
export function renderPlayer(
  ctx: CanvasRenderingContext2D,
  _playerWorldPos: Point, // kept for API compat; player is always canvas-centre
  _cameraOffset: Point,
  facing: string,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const r = 7;

  ctx.save();

  // Soft glow halo
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.8);
  glow.addColorStop(0, "rgba(232, 235, 230, 0.18)");
  glow.addColorStop(1, "rgba(232, 235, 230, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.8, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#e8ebe6";
  ctx.fill();

  // Facing triangle
  const angle = facingAngle(facing);
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(angle) * (r + 5), cy + Math.sin(angle) * (r + 5));
  ctx.lineTo(
    cx + Math.cos(angle + 2.3) * (r * 0.45),
    cy + Math.sin(angle + 2.3) * (r * 0.45),
  );
  ctx.lineTo(
    cx + Math.cos(angle - 2.3) * (r * 0.45),
    cy + Math.sin(angle - 2.3) * (r * 0.45),
  );
  ctx.closePath();
  ctx.fillStyle = "#5c6b54";
  ctx.fill();

  ctx.restore();
}

// ─── Camera helpers ──────────────────────────────────────────────────────────

/** Returns the camera world-space offset so the player appears at canvas centre. */
export function computeCameraOffset(
  playerWorldPos: Point,
  canvasWidth: number,
  canvasHeight: number,
): Point {
  return {
    x: playerWorldPos.x - canvasWidth / 2,
    y: playerWorldPos.y - canvasHeight / 2,
  };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function isInLightDisc(
  gx: number,
  gy: number,
  playerWorldPos: Point,
  lightPx: number,
): boolean {
  const cellCentreX = (gx + 0.5) * TILE_SIZE;
  const cellCentreY = (gy + 0.5) * TILE_SIZE;
  const dx = cellCentreX - playerWorldPos.x;
  const dy = cellCentreY - playerWorldPos.y;
  // Use square of distances to avoid sqrt; add half-tile slack
  return (
    dx * dx + dy * dy <=
    (lightPx + TILE_SIZE * 0.5) * (lightPx + TILE_SIZE * 0.5)
  );
}

export type EasterEggVisualRunId = Extract<RunId, "run1" | "run2" | "run3">;

/** Flat neon fills — no glow; one hue per run so the mark reads as “the egg”. */
const EGG_NEON_FILL: Record<EasterEggVisualRunId, string> = {
  run1: "#FF24D9",
  run2: "#D8FF1A",
  run3: "#18FFF2",
};

export interface EasterEggScreenMarkOpts {
  /** 0…1; fades out after collection. */
  markAlpha: number;
  runId: EasterEggVisualRunId;
}

function rgbaFromHex(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Easter-egg marker drawn *after* the circular light mask: tiny flat neon
 * square (no stroke, no gradients) — only for wayfinding in the dark.
 */
export function drawEasterEggScreenMark(
  ctx: CanvasRenderingContext2D,
  egg: Point,
  cameraOffset: Point,
  opts: EasterEggScreenMarkOpts,
): void {
  if (opts.markAlpha <= 0.02) return;
  const cx = (egg.x + 0.5) * TILE_SIZE - cameraOffset.x;
  const cy = (egg.y + 0.5) * TILE_SIZE - cameraOffset.y;
  const a = opts.markAlpha;
  const fill = rgbaFromHex(EGG_NEON_FILL[opts.runId], a);

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const half = 3;
  ctx.fillStyle = fill;
  ctx.fillRect(cx - half, cy - half, half * 2, half * 2);

  ctx.restore();
}

function drawFloor(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  isStart: boolean,
  isExit: boolean,
  isDecoyExit: boolean,
): void {
  const px = gx * TILE_SIZE;
  const py = gy * TILE_SIZE;

  // Checker-style micro-variation for concrete feel
  ctx.fillStyle = (gx + gy) % 2 === 0 ? FLOOR_A : FLOOR_B;
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

  if (isExit) {
    // Sage/green glow for the real exit
    ctx.fillStyle = "rgba(125, 154, 107, 0.28)";
    ctx.fillRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6);

    ctx.strokeStyle = "#7d9a6b";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 3.75, py + 3.75, TILE_SIZE - 7.5, TILE_SIZE - 7.5);

    // Inner cross mark
    ctx.strokeStyle = "rgba(125, 154, 107, 0.5)";
    ctx.lineWidth = 0.75;
    const mid = TILE_SIZE / 2;
    const arm = 5;
    ctx.beginPath();
    ctx.moveTo(px + mid - arm, py + mid);
    ctx.lineTo(px + mid + arm, py + mid);
    ctx.moveTo(px + mid, py + mid - arm);
    ctx.lineTo(px + mid, py + mid + arm);
    ctx.stroke();
  } else if (isDecoyExit) {
    // Muted reddish-brown — looks like an exit but feels wrong
    ctx.fillStyle = "rgba(110, 80, 80, 0.2)";
    ctx.fillRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6);
    ctx.strokeStyle = "rgba(138, 92, 92, 0.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 3.5, py + 3.5, TILE_SIZE - 7, TILE_SIZE - 7);
  } else if (isStart) {
    // Faint sage origin marker
    ctx.fillStyle = "rgba(58, 74, 56, 0.22)";
    ctx.fillRect(px + 6, py + 6, TILE_SIZE - 12, TILE_SIZE - 12);
  }
}

type WallSet = { north: boolean; east: boolean; south: boolean; west: boolean };

/** Linear wall-morph clock → eased progress (CSS cubic-bezier(0.2, 0.8, 0.2, 1)). */
function cubicBezierEase01(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const p1x = 0.2;
  const p1y = 0.8;
  const p2x = 0.2;
  const p2y = 1;
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;
  let s = t;
  for (let i = 0; i < 14; i++) {
    const x = ((ax * s + bx) * s + cx) * s;
    const dx = (3 * ax * s + 2 * bx) * s + cx;
    if (Math.abs(dx) < 1e-6) break;
    s -= (x - t) / dx;
    if (s < 0) s = 0;
    else if (s > 1) s = 1;
  }
  return ((ay * s + by) * s + cy) * s;
}

/**
 * Eased blend so walls that *open* linger faintly then dissolve (clearer read
 * than a linear wipe); new walls ease in slightly softer.
 */
function morphStrength(oldB: boolean, newB: boolean, v: number): number {
  if (oldB && !newB) {
    const u = 1 - v;
    return u * u * (1 + 0.5 * (1 - u));
  }
  if (!oldB && newB) {
    return v * v * (1 + 0.35 * (1 - v));
  }
  if (oldB && newB) return 1;
  return 0;
}

/** Blend wall thickness from `oldW` toward `newW` (v = 0 → old, 1 → new). */
function drawCellWallsMorph(
  ctx: CanvasRenderingContext2D,
  oldW: WallSet,
  newW: WallSet,
  gx: number,
  gy: number,
  v: number,
): void {
  const sn = morphStrength(oldW.north, newW.north, v);
  const se = morphStrength(oldW.east, newW.east, v);
  const ss = morphStrength(oldW.south, newW.south, v);
  const sw = morphStrength(oldW.west, newW.west, v);

  const px = gx * TILE_SIZE;
  const py = gy * TILE_SIZE;

  const thick = (st: number) => Math.max(0.5, WALL_THICKNESS * st);

  if (sn >= 0.02) {
    const t = thick(sn);
    ctx.fillStyle = WALL_BASE;
    ctx.fillRect(px, py, TILE_SIZE, t);
    ctx.fillStyle = WALL_HIGHLIGHT;
    ctx.fillRect(px, py, TILE_SIZE, Math.min(1, t * 0.55));
    ctx.fillStyle = WALL_SHADOW;
    ctx.fillRect(px, py + Math.max(0, t - 1), TILE_SIZE, 1);
  }

  if (ss >= 0.02) {
    const t = thick(ss);
    ctx.fillStyle = WALL_BASE;
    ctx.fillRect(px, py + TILE_SIZE - t, TILE_SIZE, t);
    ctx.fillStyle = WALL_SHADOW;
    ctx.fillRect(px, py + TILE_SIZE - t, TILE_SIZE, Math.min(1, t * 0.55));
  }

  if (sw >= 0.02) {
    const t = thick(sw);
    ctx.fillStyle = WALL_BASE;
    ctx.fillRect(px, py, t, TILE_SIZE);
    ctx.fillStyle = WALL_HIGHLIGHT;
    ctx.fillRect(px, py, Math.min(1, t * 0.55), TILE_SIZE);
  }

  if (se >= 0.02) {
    const t = thick(se);
    ctx.fillStyle = WALL_BASE;
    ctx.fillRect(px + TILE_SIZE - t, py, t, TILE_SIZE);
    ctx.fillStyle = WALL_SHADOW;
    ctx.fillRect(px + TILE_SIZE - t, py, Math.min(1, t * 0.55), TILE_SIZE);
  }

  const fillCornerRect = (cx: number, cy: number, a: number, b: number) => {
    const m = Math.max(a, b);
    if (m < 0.02) return;
    const t = thick(m);
    ctx.fillStyle = WALL_BASE;
    ctx.fillRect(cx, cy, t, t);
  };

  fillCornerRect(px, py, sn, sw);
  {
    const m = Math.max(sn, se);
    if (m >= 0.02) {
      const t = thick(m);
      fillCornerRect(px + TILE_SIZE - t, py, sn, se);
    }
  }
  {
    const m = Math.max(ss, sw);
    if (m >= 0.02) {
      const t = thick(m);
      fillCornerRect(px, py + TILE_SIZE - t, ss, sw);
    }
  }
  {
    const m = Math.max(ss, se);
    if (m >= 0.02) {
      const t = thick(m);
      fillCornerRect(px + TILE_SIZE - t, py + TILE_SIZE - t, ss, se);
    }
  }
}

function drawCellWalls(
  ctx: CanvasRenderingContext2D,
  walls: WallSet,
  gx: number,
  gy: number,
  isGhost: boolean,
  _alpha: number, // caller controls ctx.globalAlpha
): void {
  const px = gx * TILE_SIZE;
  const py = gy * TILE_SIZE;
  const t = WALL_THICKNESS;

  if (isGhost) {
    // Cyan ghost of removed walls
    ctx.fillStyle = "rgba(106, 232, 255, 0.55)";
    if (walls.north) ctx.fillRect(px, py, TILE_SIZE, t);
    if (walls.south) ctx.fillRect(px, py + TILE_SIZE - t, TILE_SIZE, t);
    if (walls.west) ctx.fillRect(px, py, t, TILE_SIZE);
    if (walls.east) ctx.fillRect(px + TILE_SIZE - t, py, t, TILE_SIZE);
    return;
  }

  // ── North wall ────────────────────────────────────────────────────────────
  if (walls.north) {
    // base
    ctx.fillStyle = WALL_BASE;
    ctx.fillRect(px, py, TILE_SIZE, t);
    // top-edge highlight (catches imaginary top-down light)
    ctx.fillStyle = WALL_HIGHLIGHT;
    ctx.fillRect(px, py, TILE_SIZE, 1);
    // bottom-edge shadow
    ctx.fillStyle = WALL_SHADOW;
    ctx.fillRect(px, py + t - 1, TILE_SIZE, 1);
  }

  // ── South wall ────────────────────────────────────────────────────────────
  if (walls.south) {
    ctx.fillStyle = WALL_BASE;
    ctx.fillRect(px, py + TILE_SIZE - t, TILE_SIZE, t);
    ctx.fillStyle = WALL_SHADOW;
    ctx.fillRect(px, py + TILE_SIZE - t, TILE_SIZE, 1);
  }

  // ── West wall ─────────────────────────────────────────────────────────────
  if (walls.west) {
    ctx.fillStyle = WALL_BASE;
    ctx.fillRect(px, py, t, TILE_SIZE);
    ctx.fillStyle = WALL_HIGHLIGHT;
    ctx.fillRect(px, py, 1, TILE_SIZE);
  }

  // ── East wall ─────────────────────────────────────────────────────────────
  if (walls.east) {
    ctx.fillStyle = WALL_BASE;
    ctx.fillRect(px + TILE_SIZE - t, py, t, TILE_SIZE);
    ctx.fillStyle = WALL_SHADOW;
    ctx.fillRect(px + TILE_SIZE - t, py, 1, TILE_SIZE);
  }

  // ── Corner fill (prevent diagonal gaps) ──────────────────────────────────
  // NW corner
  if (walls.north || walls.west) {
    ctx.fillStyle = WALL_BASE;
    ctx.fillRect(px, py, t, t);
  }
  // NE corner
  if (walls.north || walls.east) {
    ctx.fillStyle = WALL_BASE;
    ctx.fillRect(px + TILE_SIZE - t, py, t, t);
  }
  // SW corner
  if (walls.south || walls.west) {
    ctx.fillStyle = WALL_BASE;
    ctx.fillRect(px, py + TILE_SIZE - t, t, t);
  }
  // SE corner
  if (walls.south || walls.east) {
    ctx.fillStyle = WALL_BASE;
    ctx.fillRect(px + TILE_SIZE - t, py + TILE_SIZE - t, t, t);
  }
}

function facingAngle(facing: string): number {
  switch (facing) {
    case "north":
      return -Math.PI / 2;
    case "east":
      return 0;
    case "south":
      return Math.PI / 2;
    case "west":
      return Math.PI;
    default:
      return Math.PI / 2;
  }
}
