import type { RunId } from '../types/maze';

const RUN_IDS: RunId[] = ['run1', 'run2', 'run3', 'run4'];

export function isRunId(s: string | undefined): s is RunId {
  return s !== undefined && (RUN_IDS as string[]).includes(s);
}

export function parseRunParam(s: string | undefined): RunId | null {
  return isRunId(s) ? s : null;
}
