// Convergence — what's left after the cut.
// Helix (double strand), primaries (RGB), elevator (mood floors).

export { Helix } from "./helix.ts";
export type { StrandScore, AliveState, HelixResult } from "./helix.ts";

export {
  elevator,
  elevatorRGB,
  primariesToElevator,
  strandsToElevator,
  formatElevator,
  compactElevator,
  FLOORS,
} from "./elevator.ts";
export type {
  ElevatorReading,
  ElevatorFloor,
  ElevatorDirection,
  FloorInfo,
  RGBDetail,
} from "./elevator.ts";

export { Primaries, analyzePrimaries } from "./primaries.ts";
export type { PrimaryReading, Synthesis } from "./primaries.ts";
