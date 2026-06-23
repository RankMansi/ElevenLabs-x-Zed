# Chronos Grid

Built a browser game for the ElevenLabs × Zed collaboration: a **dark, top-down maze** where you only see a **small circle of light**, walls **reshape on a fixed schedule**, and **audio (including ElevenLabs TTS)** is part of solving—not just atmosphere. The marketing site and the maze share one stack: **Vite, React, TypeScript**, served from the `chronos-grid` package.

## What’s in the game

- **Limited vision** — Maze is almost entirely black; only tiles inside a circular “torch” are drawn (tuned in `chronos-grid/src/config/game.ts`).
- **WASD movement** with collision; optional **slow walk** for listening. **Run III** includes **sprint / stamina**-style pressure (drains while sprinting, regens when not).
- **Scheduled wall shifts** — Predictable **A/B layout changes** (no random reshuffle every frame). **Run III** layers a **slow major** reshuffle and a **fast minor** “breath” on top.
- **Audio Director** — Footsteps, shift rumble, klaxon, spatial emphasis toward exits / decoys, **truth vs lie** hint channels where runs enable lies.
- **Dread** — Standing still builds tension and **slightly shrinks** the light (capped).
- **Memory glitch** — After a shift, a **faint ghost** of the old walls can appear briefly.
- **Decoy exits** — Wrong exits use different stings; real exit is distinct.
- **Pre-baked audio** — TTS and SFX under `chronos-grid/public/audio/` with manifests/cues in `src/content/` and `src/audio/`.
- **Optional live ElevenLabs in dev** — With `ELEVENLABS_API_KEY`, Vite’s dev/preview server can expose middleware routes for chronos/music/SFX/TTS (see `chronos-grid/vite.config.ts` and `.env.example`).
- **Marketing landing** — Route `/` is a full landing experience; `/play/:runId` is the game.
- **Secret Run IV** — **Run IV** exists but stays **locked** until, **in the same tab session**, you (1) reach the **true exit** on runs **I → II → III in order** and (2) find the **hidden mark** on each of those three mazes. Unlock state is **session memory** (refresh resets the chain). Returning to `/` after unlocking can show a small celebration if the session flag was set.

## Runs (as implemented)

| Run | Subtitle | Maze | Shift notes | Lies / decoys |
|-----|----------|------|-------------|----------------|
| **I** | The Metronome | 15×15 | Periodic **~2 s** A/B | Honest hints, no decoy exit |
| **II** | The False Shepherd | 20×20 | Periodic **~2 s** A/B | ~50% lying hints, **1** decoy exit |
| **III** | Dual Clock | 24×24 | **~24 s major**, **~2 s minor** | Lying hints, **2** decoy exits |
| **IV** | Life or death (bonus) | 22×22 | Periodic **~2 s** | Lying hints, **2** decoys; **unlock** per section above |

Exact numbers live in `chronos-grid/src/config/game.ts` and `chronos-grid/src/game/run-controller.ts`.

## Run the project

From the `chronos-grid` directory (use **bun** per project convention):

```bash
cd chronos-grid
bun install
bun run dev
