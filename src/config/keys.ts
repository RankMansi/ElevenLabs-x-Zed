export const KEYS = {
  MOVE_NORTH: ['ArrowUp'],
  MOVE_SOUTH: ['ArrowDown'],
  MOVE_EAST: ['ArrowRight'],
  MOVE_WEST: ['ArrowLeft'],
  SLOW_WALK: [] as const,
  INTERACT: ['KeyE'],
  PAUSE: ['Escape', 'KeyP'],
} as const;

export type ActionKey = keyof typeof KEYS;

export function matchesKey(code: string, action: ActionKey): boolean {
  return (KEYS[action] as readonly string[]).includes(code);
}
