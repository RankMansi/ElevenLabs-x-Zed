import { GRAIN_OPACITY_BASE, GRAIN_OPACITY_DREAD_MAX } from '../config/game';
import { lerp } from '../utils/lerp';

// ---------------------------------------------------------------------------
// Off-screen grain canvas — reused across frames to avoid repeated allocation
// ---------------------------------------------------------------------------

let grainCanvas: HTMLCanvasElement | null = null;
let grainCtx: CanvasRenderingContext2D | null = null;
let lastGrainFrame = -1;
let cachedWidth = 0;
let cachedHeight = 0;

function getGrainCanvas(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (
    !grainCanvas ||
    !grainCtx ||
    cachedWidth !== width ||
    cachedHeight !== height
  ) {
    grainCanvas = document.createElement('canvas');
    grainCanvas.width = width;
    grainCanvas.height = height;
    grainCtx = grainCanvas.getContext('2d', { willReadFrequently: true })!;
    cachedWidth = width;
    cachedHeight = height;
    lastGrainFrame = -1; // force regeneration on size change
  }
  return { canvas: grainCanvas, ctx: grainCtx };
}

// ---------------------------------------------------------------------------
// Grain generation
// ---------------------------------------------------------------------------

/**
 * Write a new random noise pattern into `ctx`.
 * Each pixel is independently randomised — brightness is binary (0 or 255)
 * with a random alpha so the overlay feels organic rather than uniform.
 *
 * Using typed arrays and a single `putImageData` call keeps this fast enough
 * to run every other frame at 1080p.
 */
function generateGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const len = data.length;

  // Walk in 4-byte (RGBA) strides
  for (let i = 0; i < len; i += 4) {
    // Binary luma — avoids mid-grey wash that can desaturate the scene
    const luma = Math.random() > 0.5 ? 255 : 0;
    data[i]     = luma; // R
    data[i + 1] = luma; // G
    data[i + 2] = luma; // B
    // Alpha: uniform range 0–55 keeps individual grains subtle; the
    // composite opacity is controlled at the drawImage level.
    data[i + 3] = Math.floor(Math.random() * 56);
  }

  ctx.putImageData(imageData, 0, 0);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Draw an animated film-grain overlay onto `mainCtx`.
 *
 * @param mainCtx   - The primary game canvas context.
 * @param width     - Canvas width in pixels.
 * @param height    - Canvas height in pixels.
 * @param dreadLevel - 0..1 value driving grain intensity.
 * @param frameCount - Monotonically increasing frame counter; grain is
 *                     re-generated every 2 frames for a lively flicker while
 *                     keeping CPU cost manageable.
 */
export function drawFilmGrain(
  mainCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dreadLevel: number,
  frameCount: number,
): void {
  const { canvas, ctx } = getGrainCanvas(width, height);

  // Regenerate every 2 frames — odd/even alternation keeps the noise animated
  // without burning through pixel-write bandwidth every frame.
  if (frameCount !== lastGrainFrame && frameCount % 2 === 0) {
    generateGrain(ctx, width, height);
    lastGrainFrame = frameCount;
  }

  // Opacity interpolates between base (calm) and max (full dread)
  const clamped = Math.max(0, Math.min(1, dreadLevel));
  const opacity = lerp(GRAIN_OPACITY_BASE, GRAIN_OPACITY_DREAD_MAX, clamped);

  mainCtx.save();
  mainCtx.globalAlpha = opacity;
  // 'overlay' blend: light grain brightens midtones slightly, dark grain
  // darkens them — creates authentic photochemical noise feel.
  mainCtx.globalCompositeOperation = 'overlay';
  mainCtx.drawImage(canvas, 0, 0);
  mainCtx.restore();
}

// ---------------------------------------------------------------------------
// Scanline / CRT-style horizontal-band pass (optional layer)
// ---------------------------------------------------------------------------

/**
 * Draw a very faint scanline pattern over the canvas.
 * At rest this is nearly invisible (opacity ~0.012); at high dread it crawls
 * upward at a slow drift speed to suggest a destabilising display.
 *
 * @param mainCtx     - Primary canvas context.
 * @param width       - Canvas width.
 * @param height      - Canvas height.
 * @param dreadLevel  - 0..1; gates visibility and drift speed.
 * @param elapsedMs   - Total elapsed run time in milliseconds, used for drift.
 */
export function drawScanlines(
  mainCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dreadLevel: number,
  elapsedMs: number,
): void {
  const clamped = Math.max(0, Math.min(1, dreadLevel));
  // Scanlines only appear above 40 % dread
  if (clamped < 0.4) return;

  const intensity = (clamped - 0.4) / 0.6; // 0..1 above threshold
  const baseOpacity = lerp(0, 0.012, intensity);
  if (baseOpacity <= 0) return;

  // Drift: at peak dread, scroll ~4 px/s upward
  const driftPx = ((elapsedMs * lerp(0, 4, intensity)) / 1000) % 4;

  mainCtx.save();
  mainCtx.globalAlpha = baseOpacity;
  mainCtx.globalCompositeOperation = 'source-over';
  mainCtx.strokeStyle = '#000000';
  mainCtx.lineWidth = 1;

  for (let y = Math.floor(-driftPx); y < height + 4; y += 4) {
    mainCtx.beginPath();
    mainCtx.moveTo(0, y);
    mainCtx.lineTo(width, y);
    mainCtx.stroke();
  }

  mainCtx.restore();
}

// ---------------------------------------------------------------------------
// Chromatic aberration fringe (extreme dread flash)
// ---------------------------------------------------------------------------

/**
 * At very high dread (≥ 0.85) briefly split the canvas into RGB channels
 * with a small lateral offset — mimics a CRT phosphor misalignment glitch.
 *
 * This is designed to be called at most once per second to avoid nausea.
 *
 * @param mainCtx    - Primary canvas context.
 * @param snapshot   - An ImageBitmap or OffscreenCanvas of the scene BEFORE
 *                     this effect, so we can re-draw it with channel offsets.
 *                     Pass `null` to skip (safe no-op).
 * @param dreadLevel - 0..1.
 * @param intensity  - 0..1 flash intensity (e.g. driven by a brief timer).
 */
export function drawChromaticAberration(
  mainCtx: CanvasRenderingContext2D,
  snapshot: ImageBitmap | null,
  dreadLevel: number,
  intensity: number,
): void {
  if (!snapshot || dreadLevel < 0.85 || intensity <= 0) return;

  const shift = Math.round(lerp(0, 4, intensity)); // 0–4 px
  if (shift === 0) return;

  const w = mainCtx.canvas.width;
  const h = mainCtx.canvas.height;

  // Red channel — shifted left
  mainCtx.save();
  mainCtx.globalCompositeOperation = 'screen';
  mainCtx.globalAlpha = intensity * 0.35;

  // Tint via multiply filter when available; fall back to raw blit
  if (typeof mainCtx.filter !== 'undefined') {
    mainCtx.filter = 'url(#red-channel)'; // requires SVG filter in DOM; gracefully ignored if absent
  }

  mainCtx.drawImage(snapshot, -shift, 0, w, h);

  // Blue channel — shifted right
  mainCtx.drawImage(snapshot, shift, 0, w, h);

  mainCtx.restore();
}

// ---------------------------------------------------------------------------
// Frame-level cleanup helper
// ---------------------------------------------------------------------------

/**
 * Release the cached off-screen grain canvas.
 * Call this when the game session ends to free GPU-backed memory.
 */
export function disposeGrainCanvas(): void {
  grainCanvas = null;
  grainCtx = null;
  lastGrainFrame = -1;
  cachedWidth = 0;
  cachedHeight = 0;
}
