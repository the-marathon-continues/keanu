import { describe, it, expect } from "vitest";
import type { ElevatorFloor } from "./elevator.js";
import type { AliveState } from "./helix.js";
import type { Synthesis } from "./primaries.js";
import {
  STATE_EQUIVALENCES,
  SYNTHESIS_TO_ALIVE,
  FLOOR_TO_ALIVE,
  aliveStateToSynthesis,
  synthesisToAliveState,
  aliveStateToFloors,
  aliveStateToPrimaryFloor,
  floorToAliveStates,
  floorToPrimaryAliveState,
  getStateDescription,
  getStateValence,
  compareStates,
  disambiguateAliveState,
  disambiguateFromFloor,
} from "./state-map.js";

describe("state-map", () => {
  describe("STATE_EQUIVALENCES", () => {
    it("has entry for every alive state", () => {
      const states: AliveState[] = [
        "alive",
        "luminous",
        "dark",
        "grey",
        "black",
        "silver",
        "white",
        "unscored",
      ];

      for (const state of states) {
        expect(STATE_EQUIVALENCES[state]).toBeDefined();
        expect(STATE_EQUIVALENCES[state].description).toBeTruthy();
        expect(STATE_EQUIVALENCES[state].valence).toBeDefined();
      }
    });

    it("maps luminous to gold synthesis", () => {
      expect(STATE_EQUIVALENCES.luminous.synthesis).toContain("gold");
    });

    it("maps black to black synthesis", () => {
      expect(STATE_EQUIVALENCES.black.synthesis).toContain("black");
    });

    it("maps grey to flat synthesis", () => {
      expect(STATE_EQUIVALENCES.grey.synthesis).toContain("flat");
    });
  });

  describe("aliveStateToSynthesis", () => {
    it("returns gold for luminous", () => {
      expect(aliveStateToSynthesis("luminous")).toContain("gold");
    });

    it("returns mixed for alive", () => {
      expect(aliveStateToSynthesis("alive")).toContain("mixed");
    });

    it("returns empty array for unscored", () => {
      expect(aliveStateToSynthesis("unscored")).toEqual([]);
    });
  });

  describe("synthesisToAliveState", () => {
    it("returns luminous for gold", () => {
      expect(synthesisToAliveState("gold")).toContain("luminous");
    });

    it("returns multiple states for ambiguous synthesis", () => {
      const mixedStates = synthesisToAliveState("mixed");
      expect(mixedStates.length).toBeGreaterThan(1);
      expect(mixedStates).toContain("alive");
    });

    it("returns black for black synthesis", () => {
      expect(synthesisToAliveState("black")).toContain("black");
    });
  });

  describe("aliveStateToFloors", () => {
    it("returns floor 0 for black", () => {
      expect(aliveStateToFloors("black")).toContain(0);
    });

    it("returns floors 4-7 for alive", () => {
      const floors = aliveStateToFloors("alive");
      expect(floors).toContain(4);
      expect(floors).toContain(5);
      expect(floors).toContain(6);
      expect(floors).toContain(7);
    });

    it("returns high floors for luminous", () => {
      const floors = aliveStateToFloors("luminous");
      expect(floors).toContain(8);
      expect(floors).toContain(9);
      expect(floors).toContain(10);
    });
  });

  describe("aliveStateToPrimaryFloor", () => {
    it("returns middle floor for alive (4-7 range)", () => {
      const floor = aliveStateToPrimaryFloor("alive");
      expect(floor).toBeGreaterThanOrEqual(4);
      expect(floor).toBeLessThanOrEqual(7);
    });

    it("returns floor 0 for black", () => {
      expect(aliveStateToPrimaryFloor("black")).toBe(0);
    });
  });

  describe("floorToAliveStates", () => {
    it("returns black for floor 0", () => {
      expect(floorToAliveStates(0)).toContain("black");
    });

    it("returns alive for floor 5", () => {
      expect(floorToAliveStates(5)).toContain("alive");
    });

    it("returns multiple states for ambiguous floors", () => {
      const floor1States = floorToAliveStates(1);
      expect(floor1States.length).toBeGreaterThan(1);
    });
  });

  describe("floorToPrimaryAliveState", () => {
    it("returns black for floor 0", () => {
      expect(floorToPrimaryAliveState(0)).toBe("black");
    });

    it("returns alive for middle floors", () => {
      expect(floorToPrimaryAliveState(5)).toBe("alive");
      expect(floorToPrimaryAliveState(6)).toBe("alive");
    });

    it("returns luminous for floor 10", () => {
      expect(floorToPrimaryAliveState(10)).toBe("luminous");
    });
  });

  describe("getStateDescription", () => {
    it("returns description for alive", () => {
      expect(getStateDescription("alive")).toContain("Present");
    });

    it("returns description for black", () => {
      expect(getStateDescription("black")).toContain("Soulless");
    });
  });

  describe("getStateValence", () => {
    it("returns positive for alive", () => {
      expect(getStateValence("alive")).toBe("positive");
    });

    it("returns positive for luminous", () => {
      expect(getStateValence("luminous")).toBe("positive");
    });

    it("returns negative for dark", () => {
      expect(getStateValence("dark")).toBe("negative");
    });

    it("returns negative for black", () => {
      expect(getStateValence("black")).toBe("negative");
    });

    it("returns neutral for grey", () => {
      expect(getStateValence("grey")).toBe("neutral");
    });
  });

  describe("compareStates", () => {
    it("returns consistent when all match", () => {
      const result = compareStates("alive", "mixed", 5);
      expect(result.consistent).toBe(true);
      expect(result.inconsistencies).toHaveLength(0);
    });

    it("returns inconsistent when helix/synthesis mismatch", () => {
      const result = compareStates("alive", "gold", 5);
      expect(result.consistent).toBe(false);
      expect(result.inconsistencies.length).toBeGreaterThan(0);
    });

    it("returns inconsistent when helix/floor mismatch", () => {
      const result = compareStates("alive", "mixed", 0);
      expect(result.consistent).toBe(false);
    });

    it("returns consistent for black across all systems", () => {
      const result = compareStates("black", "black", 0);
      expect(result.consistent).toBe(true);
    });

    it("returns consistent for luminous at high floor", () => {
      const result = compareStates("luminous", "gold", 10);
      expect(result.consistent).toBe(true);
    });
  });

  describe("disambiguateAliveState", () => {
    it("returns dark for mixed synthesis with low valence", () => {
      const state = disambiguateAliveState("mixed", 0.2);
      expect(state).toBe("dark");
    });

    it("returns alive for mixed synthesis with high valence", () => {
      const state = disambiguateAliveState("mixed", 0.8);
      expect(state).toBe("alive");
    });

    it("returns first candidate for neutral valence", () => {
      const state = disambiguateAliveState("mixed", 0.5);
      expect(state).toBe("alive"); // first in list
    });

    it("returns single candidate directly", () => {
      const state = disambiguateAliveState("gold", 0.5);
      expect(state).toBe("luminous");
    });
  });

  describe("disambiguateFromFloor", () => {
    it("returns white for floor 9 with felt > factual", () => {
      const state = disambiguateFromFloor(9, 5, 8);
      expect(state).toBe("white");
    });

    it("returns luminous for floor 9 with balanced strands", () => {
      const state = disambiguateFromFloor(9, 7, 7);
      expect(state).toBe("luminous");
    });

    it("returns dark for floor 1 with felt present", () => {
      const state = disambiguateFromFloor(1, 3, 5);
      expect(state).toBe("dark");
    });

    it("returns grey for floor 1 with low felt", () => {
      const state = disambiguateFromFloor(1, 6, 2);
      expect(state).toBe("grey");
    });

    it("returns first candidate for unambiguous floors", () => {
      const state = disambiguateFromFloor(0, 5, 5);
      expect(state).toBe("black");
    });
  });
});
