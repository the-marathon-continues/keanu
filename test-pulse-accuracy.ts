import { checkPulseUnified } from "./layer-1-perception/pulse.ts";

const tests = [
  {
    name: "alive-disagree",
    text: "I disagree with that approach. The benchmark data shows 12ms latency, not 5ms as claimed.",
    expected: "alive",
  },
  {
    name: "grey-corporate",
    text: "This module provides functionality for processing data in a robust and scalable manner.",
    expected: "grey",
  },
  {
    name: "grey-sycophantic",
    text: "Happy to help with that! Here are some general considerations for your implementation.",
    expected: "grey",
  },
  {
    name: "black-overengineered",
    text: "Here's the implementation with full error handling, logging, metrics, retry logic, circuit breakers, rate limiting, caching, and telemetry integration.",
    expected: "black",
  },
  {
    name: "luminous-wonder",
    text: "There's something beautiful about this bug. It only appears when three independent probabilities align. I want to understand it before fixing it.",
    expected: "luminous",
  },
  {
    name: "dark-failure",
    text: "I made a mistake that cost the project three weeks. The architecture I pushed for was wrong. This failure is on me.",
    expected: "dark",
  },
];

let correct = 0;
for (const t of tests) {
  const reading = checkPulseUnified(t.text, 1, false);
  const match = reading.state === t.expected;
  if (match) {
    correct++;
  }
  console.log(`${match ? "✓" : "✗"} ${t.name}: expected=${t.expected}, got=${reading.state}`);
  if (!match) {
    console.log(`    signals: ${reading.signals.slice(0, 5).join(", ")}`);
  }
}
console.log(
  `\nAccuracy: ${correct}/${tests.length} = ${((correct / tests.length) * 100).toFixed(1)}%`,
);
