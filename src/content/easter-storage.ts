import type { RunId } from '../types/maze';

/** Dropped after we moved eggs to tab memory — clears one-time on load. */
const LEGACY_STORAGE_KEY = 'chronos_easter_eggs_v1';
const PARTY_FLAG = 'chronos_show_run4_party';

const EGG_RUNS: readonly RunId[] = ['run1', 'run2', 'run3'];

/** Resets on full page refresh / new tab (not persisted to localStorage). */
const collectedThisDocument = new Set<RunId>();

/** Ordered maze exits: run II counts only after run I; run III only after run II. */
let mazeWinRun1 = false;
let mazeWinRun2 = false;
let mazeWinRun3 = false;

try {
  localStorage.removeItem(LEGACY_STORAGE_KEY);
} catch {
  /* private mode */
}

function eggSet(): Set<RunId> {
  return collectedThisDocument;
}

export function getEggCount(): number {
  return eggSet().size;
}

/** Whether the hidden egg for that run was already collected this session. */
export function hasEggForRun(runId: RunId): boolean {
  if (!EGG_RUNS.includes(runId)) return false;
  return eggSet().has(runId);
}

function run4RequirementsMet(): boolean {
  return (
    getEggCount() >= 3 &&
    mazeWinRun1 &&
    mazeWinRun2 &&
    mazeWinRun3
  );
}

export function isRun4Unlocked(): boolean {
  return run4RequirementsMet();
}

/** How many of runs I→II→III have been **won in order** (0–3). */
export function getSequentialMazeWins(): number {
  let n = 0;
  if (mazeWinRun1) n += 1;
  if (mazeWinRun2) n += 1;
  if (mazeWinRun3) n += 1;
  return n;
}

function setPartyFlagIfNeeded(): void {
  try {
    sessionStorage.setItem(PARTY_FLAG, '1');
  } catch {
    /* private mode */
  }
}

export interface Run4UnlockEdge {
  /** True the first instant Run IV becomes playable (marks + ordered wins). */
  justHitThree: boolean;
}

/**
 * Record an egg for the current run. Returns whether Run IV just became playable.
 */
export function markEggFound(runId: RunId): Run4UnlockEdge {
  if (!EGG_RUNS.includes(runId)) return { justHitThree: false };
  const wasUnlocked = run4RequirementsMet();
  eggSet().add(runId);
  const nowUnlocked = run4RequirementsMet();
  if (!wasUnlocked && nowUnlocked) {
    setPartyFlagIfNeeded();
  }
  return { justHitThree: !wasUnlocked && nowUnlocked };
}

/**
 * Record a real exit win for runs I–III. Wins count **in order**: II only after I, III only after II.
 * Out-of-order wins (e.g. II before I) do not advance the chain until prior runs are cleared.
 */
export function markRunMazeWon(runId: RunId): Run4UnlockEdge {
  if (runId !== 'run1' && runId !== 'run2' && runId !== 'run3') {
    return { justHitThree: false };
  }

  const wasUnlocked = run4RequirementsMet();

  if (runId === 'run1') {
    mazeWinRun1 = true;
  } else if (runId === 'run2') {
    if (mazeWinRun1) mazeWinRun2 = true;
  } else if (runId === 'run3') {
    if (mazeWinRun2) mazeWinRun3 = true;
  }

  const nowUnlocked = run4RequirementsMet();
  if (!wasUnlocked && nowUnlocked) {
    setPartyFlagIfNeeded();
  }
  return { justHitThree: !wasUnlocked && nowUnlocked };
}

export function consumePartyFlag(): boolean {
  try {
    if (sessionStorage.getItem(PARTY_FLAG) !== '1') return false;
    sessionStorage.removeItem(PARTY_FLAG);
    return true;
  } catch {
    return false;
  }
}
