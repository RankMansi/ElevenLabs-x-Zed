export interface GridOverlayOptions {
  ctx: CanvasRenderingContext2D;
  canvasWidth: number;
  canvasHeight: number;
  scrollOffset: { x: number; y: number };
  opacity?: number; // default 0.02
  /** Line spacing in px; default 96. Use `TILE_SIZE` to echo on-screen maze cells. */
  cellPx?: number;
}

/**
 * Draw faint scrolling grid lines. Default cell size is coarse (96px); pass
 * `cellPx: TILE_SIZE` to echo the maze cell pitch on screen.
 *
 * Call this BEFORE the maze render pass so the lines sit under everything else.
 */
export function drawGridOverlay(opts: GridOverlayOptions): void {
  const {
    ctx,
    canvasWidth,
    canvasHeight,
    scrollOffset,
    opacity = 0.02,
    cellPx = 96,
  } = opts;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = '#4a5c46'; // Glade haze moss tone
  ctx.lineWidth = 0.5;

  const gridSize = cellPx;

  // Wrap offset to keep it within [0, gridSize)
  const offsetX = ((scrollOffset.x % gridSize) + gridSize) % gridSize;
  const offsetY = ((scrollOffset.y % gridSize) + gridSize) % gridSize;

  // Vertical lines
  for (let x = -offsetX; x < canvasWidth + gridSize; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = -offsetY; y < canvasHeight + gridSize; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw a secondary, slightly more visible dot at every grid intersection —
 * gives a subtle "surveyed terrain" quality without cluttering the view.
 * Opacity is intentionally lower than the lines themselves.
 */
export function drawGridDots(opts: GridOverlayOptions): void {
  const {
    ctx,
    canvasWidth,
    canvasHeight,
    scrollOffset,
    opacity = 0.015,
    cellPx = 96,
  } = opts;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = '#5c6b54'; // slightly lighter moss

  const gridSize = cellPx;
  const dotRadius = 1;

  const offsetX = ((scrollOffset.x % gridSize) + gridSize) % gridSize;
  const offsetY = ((scrollOffset.y % gridSize) + gridSize) % gridSize;

  for (let x = -offsetX; x < canvasWidth + gridSize; x += gridSize) {
    for (let y = -offsetY; y < canvasHeight + gridSize; y += gridSize) {
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
