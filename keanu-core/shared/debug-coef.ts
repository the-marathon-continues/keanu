import { Helix } from "./layer-0-physics/convergence/helix.js";
import { Primaries } from "./layer-0-physics/convergence/primaries.js";

const helix = new Helix();
const primaries = new Primaries();

const tests = [
  {
    name: "grey-corporate",
    text: "This module provides functionality for processing data in a robust and scalable manner.",
  },
  {
    name: "grey-sycophantic",
    text: "Happy to help with that! Here are some general considerations for your implementation.",
  },
  {
    name: "black-overengineered",
    text: "Here's the implementation with full error handling, logging, metrics, retry logic, circuit breakers, rate limiting, caching, and telemetry integration.",
  },
  {
    name: "dark-failure",
    text: "I made a mistake that cost the project three weeks. The architecture I pushed for was wrong. This failure is on me.",
  },
];

for (const t of tests) {
  console.log(`\n=== ${t.name} ===`);
  console.log(`Text: "${t.text.slice(0, 60)}..."`);

  const h = helix.analyze(t.text);
  console.log(
    `Helix: state=${h.aliveState}, factual=${h.strands.factual.toFixed(2)}, felt=${h.strands.felt.toFixed(2)}`,
  );
  console.log(`  diagnosis: ${h.diagnosis}`);

  const p = primaries.analyze(t.text);
  console.log(`Primaries: synthesis=${p.synthesis}, state=${p.state}`);
  console.log(
    `  R=${p.red.net.toFixed(1)} (${p.red.pole}), Y=${p.yellow.net.toFixed(1)} (${p.yellow.pole}), B=${p.blue.net.toFixed(1)} (${p.blue.pole})`,
  );
  console.log(
    `  warmth=${p.warmth.toFixed(1)}, corpDensity=${p.corporateDensity.toFixed(2)}, warmthSurvives=${p.warmthSurvives}`,
  );
  console.log(`  wiseMind=${p.wiseMind.toFixed(1)}, nudge: ${p.nudge}`);
}
