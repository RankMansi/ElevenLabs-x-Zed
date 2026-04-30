import { TILE_SIZE, VIGNETTE_FEATHER } from "../config/game";
import { smoothstep } from "../utils/lerp";

export interface LightMaskOptions {
  ctx: CanvasRenderingContext2D;
  centerX: number;
  centerY: number;
  radiusTiles: number;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Apply the circular light mask.
 *
 * CRITICAL RENDER ORDER CONTRACT:
 *   The maze, player, and all world-space content MUST be drawn BEFORE this
 *   function is called.  This function only adds darkness on top — it never
 *   erases pre-existing pixels inside the lit disc.
 *
 * How it works (donut / even-odd path approach):
 *   1. Build a composite path:  outer rectangle  +  inner CCW circle.
 *   2. Fill with "evenodd" rule.
 *      - Area covered only by rect  (outside disc)  →  winding count = 1  →  FILLED (black).
 *      - Area covered by rect AND circle (inside disc) →  winding count = 0  →  NOT filled.
 *   3. Overlay a radial gradient for the moss-tinted feathered rim.
 *
 * This is strictly additive — it only draws OVER the outside-disc region,
 * leaving every pixel inside the disc exactly as the renderer left them.
 */
export function applyLightMask(opts: LightMaskOptions): void {
  const { ctx, centerX, centerY, radiusTiles, canvasWidth, canvasHeight } =
    opts;

  const radiusPx = radiusTiles * TILE_SIZE;
  const featherPx = radiusPx * VIGNETTE_FEATHER;

  // ── Step 1: Hard donut fill — black outside the disc ────────────────────
  ctx.save();
  ctx.beginPath();

  // Outer rectangle — clockwise winding (canvas default).
  ctx.rect(0, 0, canvasWidth, canvasHeight);

  // Inner circle — COUNTER-clockwise winding so even-odd leaves it unfilled.
  ctx.arc(centerX, centerY, radiusPx, 0, Math.PI * 2, true /* anticlockwise */);

  ctx.fillStyle = "#070809";
  ctx.fill("evenodd");
  ctx.restore();

  // ── Step 2: Soft vignette rim — moss-tinted feather at the disc edge ────
  // Painted in source-over on top of everything (including the hard donut),
  // so it softens the circle edge with a gentle organic falloff rather than a
  // crisp geometric cutout.
  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  const softInner = radiusPx - featherPx; // where the gradient starts
  const softOuter = radiusPx + featherPx * 0.4; // where it fully closes off

  const vignette = ctx.createRadialGradient(
    centerX,
    centerY,
    Math.max(0, softInner),
    centerX,
    centerY,
    softOuter,
  );

  vignette.addColorStop(0, "rgba(  7,   8,   9, 0)"); // transparent inner edge
  vignette.addColorStop(0.3, "rgba( 74,  92,  70, 0.10)"); // moss tint begins
  vignette.addColorStop(0.6, "rgba( 30,  40,  28, 0.45)"); // dark-moss ramp
  vignette.addColorStop(0.85, "rgba(  7,   8,   9, 0.90)"); // near-void
  vignette.addColorStop(1.0, "rgba(  7,   8,   9, 1)"); // full void at outer edge

  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.restore();
}

/**
 * Draw a warm ambient centre-glow before the maze tiles are rendered.
 *
 * Uses `screen` blend mode so it only brightens, never blows out.
 * Keep opacity values at or below 0.05 — this is atmosphere, not a spotlight.
 *
 * Call this BEFORE renderMaze so the glow sits underneath the wall geometry.
 */
export function drawLightCenter(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radiusPx: number,
): void {
  const gradient = ctx.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    radiusPx,
  );

  gradient.addColorStop(0, "rgba(255, 250, 240, 0.045)"); // warm ivory hot-spot
  gradient.addColorStop(0.25, "rgba(200, 210, 190, 0.022)"); // cool-warm blend
  gradient.addColorStop(0.55, "rgba( 74,  92,  70, 0.012)"); // faint moss
  gradient.addColorStop(1, "rgba(  0,   0,   0, 0)"); // fade to nothing

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radiusPx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Convert a light radius in tiles to pixels.
 */
export function lightRadiusToPx(radiusTiles: number): number {
  return radiusTiles * TILE_SIZE;
}

/**
 * Return 0–1 edge-proximity for a world point relative to the lit disc.
 * 0 = at the centre, 1 = at or beyond the feathered edge.
 * Useful for driving per-pixel dread tinting or glow effects.
 */
export function edgeProximity(
  worldX: number,
  worldY: number,
  centerX: number,
  centerY: number,
  radiusTiles: number,
): number {
  const radiusPx = radiusTiles * TILE_SIZE;
  const innerEdge = radiusPx * (1 - VIGNETTE_FEATHER);
  const dist = Math.hypot(worldX - centerX, worldY - centerY);
  return smoothstep(innerEdge, radiusPx, dist);
}
