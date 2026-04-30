import React from 'react';
import { clamp } from '../utils/clamp';

interface FilmGrainOverlayProps {
  dreadLevel?: number; // 0..1
  /** Extra opacity (e.g. 0.05 during briefing deck). */
  extraOpacity?: number;
}

/**
 * Full-screen film grain overlay.
 * At dread = 0 : ~2.5% opacity (always-on premium texture)
 * At dread = 1 : ~5.5% opacity (claustrophobic, sweaty feel)
 *
 * Uses a CSS SVG-noise background which is cheap and frame-rate-independent.
 * The Canvas-based grain in post-fx.ts adds animated noise on top of this
 * during the render pass, so together they feel alive without being distracting.
 */
export const FilmGrainOverlay: React.FC<FilmGrainOverlayProps> = ({
  dreadLevel = 0,
  extraOpacity = 0,
}) => {
  const BASE_OPACITY = 0.025;
  const MAX_OPACITY  = 0.055;
  const opacity = Math.min(
    0.14,
    BASE_OPACITY +
      (MAX_OPACITY - BASE_OPACITY) * clamp(dreadLevel, 0, 1) +
      extraOpacity,
  );

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 200,
        opacity,
        mixBlendMode: 'overlay',
        // SVG fractal noise — renders as static grain, no external asset needed
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23g)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '256px 256px',
      }}
    />
  );
};
