/**
 * ElevenLabs Music prompt (English). Duplicated in `vite/chronos-elevenlabs-middleware.ts`.
 */

export const CHRONOS_BGM_PROMPT = [
  'Cinematic instrumental only — NO vocals.',
  'NOT horror or scary: avoid ominous drones, creeping dread, spooky stabs, jump-scare impacts, dissonant scrapes as the main feature, dark ambient noise walls, evil bass growls, demonic undertones, or pure horror sound design. Tension = high stakes, not terror.',
  'Theme: blockbuster survival thriller — gigantic cold grey stone labyrinth beside a fragile pocket of greenery; restrained natural “alive” shimmer against vast mineral scale.',
  'Emotional mix: adrenaline, urgency, camaraderie-in-adversity, curiosity, bittersweet determination — never terror.',
  'Orchestral-electronic hybrid: wide strings with short bow attacks (never screeching horror strings); brass low and noble (NO trailer “BRAAAM”); light driving percussion like a measured running pace around 100–112 BPM — NOT four-on-the-floor club.',
  'Subtle organic layers: soft wind and air; airy choir PADS ONLY — neutral “aaa” pad texture, extremely quiet, vowel-neutral, background wash only — NOT epic chant or lead vocals. Occasional clean electric guitar or plucked harp-like pings for hope.',
  'Harmony: open, slightly unresolved minor with rising hopeful motion; avoid cliché spooky Phrygian horror color. Keep ambiguity forward-moving and optimistic-adrenal, not dread.',
  'STRUCTURE (single ~90s piece that still evolves; optimistic survival energy):',
  'Opening: sunrise-through-fog sparkle; thin bright highs, warm low mids; a steady soft pulse emerges.',
  'Middle: widen the space — sense of SCALE in big corridors; driving rhythm subtly stronger; shimmering highs like distant bioluminescent leaves against cold restrained metallic taps (order / system).',
  'Bridge: heroic lift but restrained — “determined sprint,” not a victory fanfare or triumphant climax.',
  'Downshift: breathable strip-back — wind, muted pulse, gentle shimmer so the energy can loop.',
  'LOOP REQUIREMENT (endless gameplay): The LAST 12 SECONDS must glide back toward the opening texture and a similar loudness spectrum — NO finale sting, NO resolved major cadence, NO horror tail. End with air + soft pulse + gentle shimmer so second 0 connects seamlessly when looped.',
  'Bans: horror strings as lead, jump-scare hits, ominous drone walls, trailer BRAAAM, epic choir climax, cheesy horror stab, obvious final chord or ritardando “finished” ending.',
  'Prefer crossfade-friendly textures and controlled dynamics at the tail over huge transient peaks in the final seconds.',
].join(' ');

export const CHRONOS_SFX_ATMOSPHERE_PROMPT = [
  'Seamless looping bed: subterranean air movement, faint far-off electrical hum,',
  'microscopic water drips, no melody, no rhythm, no voice, ultra-wide stereo wash.',
].join(' ');

export const CHRONOS_BGM_LENGTH_MS = 90_000;
export const CHRONOS_SFX_DURATION_SEC = 22;
