export type RunId = 'run1' | 'run2' | 'run3' | 'run4';

export interface Point {
  x: number; // column index
  y: number; // row index
}

export interface Cell {
  x: number;
  y: number;
  walls: {
    north: boolean;
    east: boolean;
    south: boolean;
    west: boolean;
  };
  visited: boolean;
  isExit: boolean;
  isDecoyExit: boolean;
  isStart: boolean;
}

export interface Maze {
  width: number;
  height: number;
  cells: Cell[][];
  start: Point;
  exit: Point;
  decoyExits: Point[];
}

export interface WallSegment {
  from: Point;
  to: Point;
  direction: 'north' | 'east' | 'south' | 'west';
}

export interface MazeState {
  id: string; // 'A' or 'B' or 'A-minor' etc
  wallOverrides: WallToggle[];
}

export interface WallToggle {
  cell: Point;
  wall: 'north' | 'east' | 'south' | 'west';
  open: boolean; // true = remove wall, false = add wall
}
