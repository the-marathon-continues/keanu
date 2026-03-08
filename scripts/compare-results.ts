import { readFile } from "node:fs/promises";

const file = process.argv[2] || "results/capability-2026-03-07.json";
const data = JSON.parse(await readFile(file, "utf-8"));
const results = data.challenges || data.results || [];

if (results.length === 0) {
  console.log("No results found in", file);
  process.exit();
}

console.log(`\n${results.length} challenges in ${file}\n`);

// Show first 3 comparisons
for (const r of results.slice(0, 3)) {
  console.log("═══════════════════════════════════════");
  console.log("Challenge:", r.challenge?.id);
  console.log("Prompt:", r.challenge?.prompt?.slice(0, 100));
  console.log("");
  console.log("--- RAW (Claude alone) ---");
  console.log(r.raw?.response?.slice(0, 400) || "(no response)");
  console.log("");
  console.log("--- KEANU (3-model loop) ---");
  console.log(r.withKeanu?.response?.slice(0, 400) || "(no response)");
  console.log("");
}
