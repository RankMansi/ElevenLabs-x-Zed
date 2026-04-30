export const ENV = {
  debugMode: import.meta.env.VITE_DEBUG_MODE === 'true',
  showMinimap: import.meta.env.VITE_SHOW_MINIMAP === 'true',
} as const;
