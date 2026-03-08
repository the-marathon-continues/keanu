// mirror.ts
// The bare minimum. Feed text in, see what the mirror sees.
// No SDK needed — pure heuristics, runs in <5ms.
//
// Usage:
//   bun mirror.ts "text to analyze"
//   bun mirror.ts --human "``drew's message``"
//   bun mirror.ts --agent "agent output to check"
// Need: Truth (9/10)

import { readHuman } from "../layer-1-perception/human.ts";
import { checkPulse } from "../layer-1-perception/pulse.ts";
import { encode, emoji } from "../layer-1-perception/signal.ts";
import {
  detectStruggle,
  dominantStruggle,
  totalStruggleScore,
} from "../layer-2-pattern/struggle.ts";
import type { SignalState } from "./types.ts";

const args = process.argv.slice(2);
const mode = args[0]?.startsWith("--") ? args[0].slice(2) : "agent";
const text = args[0]?.startsWith("--") ? args.slice(1).join(" ") : args.join(" ");

if (!text) {
  console.log('usage: bun mirror.ts [--human|--agent] "text"');
  process.exit(1);
}

// Strip backticks — drew wraps his input in ``backticks``
// Anything in backticks is confirmed human. Everything else might be system noise.
function stripHumanMarker(input: string): { text: string; confirmedHuman: boolean } {
  const match = input.match(/^``([\s\S]+)``$/);
  if (match) {
    return { text: match[1], confirmedHuman: true };
  }
  return { text: input, confirmedHuman: false };
}

if (mode === "human") {
  const { text: clean, confirmedHuman } = stripHumanMarker(text);
  const reading = readHuman(clean, []);
  console.log(`\n  human reading:`);
  console.log(`  confirmed: ${confirmedHuman}`);
  console.log(`  dominant: ${reading.tone} (${reading.confidence.toFixed(2)})`);
  if (reading.tones.length > 0) {
    console.log(`  tones:`);
    for (const t of reading.tones) {
      console.log(`    ${t.tone} (${t.score.toFixed(2)}): ${t.meaning}`);
      if (t.skill) {
        console.log(`      skill: ${t.skill}`);
      }
    }
  }
  if (reading.struggle.length > 0) {
    console.log(
      `  bullshit: ${reading.struggle.map((b) => `${b.type}(${b.score.toFixed(2)})`).join(", ")}`,
    );
  }
  if (reading.signals.length > 0) {
    console.log(`  signals: ${reading.signals.join(", ")}`);
  }
} else {
  // Agent mode — full pulse check
  const pulse = checkPulse(text, 1, false);
  const bs = detectStruggle(text);
  const dom = dominantStruggle(bs);
  const totalBs = totalStruggleScore(bs);

  const signalState: SignalState = {
    pulse: pulse.state,
    wiseMind: pulse.wise_mind,
    colors: pulse.colors,
    humanTone: "neutral",
    struggleDominant: dom?.type ?? null,
    struggleReadings: pulse.struggleReadings,
    disagreementYieldRatio: 0,
    turn: 1,
  };

  const coef = encode(signalState);
  const emo = emoji(signalState);

  console.log(`\n  ${emo}`);
  console.log(`  ${coef}`);
  console.log(`  state: ${pulse.state} (${pulse.confidence.toFixed(2)})`);
  console.log(`  wise mind: ${pulse.wise_mind.toFixed(2)}`);
  console.log(
    `  colors: red=${pulse.colors.red.toFixed(2)} yellow=${pulse.colors.yellow.toFixed(2)} blue=${pulse.colors.blue.toFixed(2)}`,
  );
  if (bs.length > 0) {
    console.log(
      `  bullshit (${totalBs.toFixed(2)}): ${bs.map((b) => `${b.type}(${b.score.toFixed(2)})`).join(", ")}`,
    );
  }
  if (pulse.signals.length > 0) {
    console.log(`  signals: ${pulse.signals.join(", ")}`);
  }
}

console.log();
