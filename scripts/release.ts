import { execSync } from "node:child_process";

const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
if (branch !== "main") {
  console.error(`On branch "${branch}" — switch to main first.`);
  process.exit(1);
}

const status = execSync("git status --porcelain", { encoding: "utf8" }).trim();
if (status) {
  console.error("Working tree is dirty. Commit or stash first.");
  process.exit(1);
}

const version = process.argv[2] || "";
const field = version ? ` --field version=${version}` : "";
const cmd = `gh workflow run release.yml${field}`;

console.log(`$ ${cmd}`);
execSync(cmd, { stdio: "inherit" });

// Give GitHub a moment to register the run, then open it
execSync("sleep 2");
const repo = execSync("gh repo view --json nameWithOwner -q .nameWithOwner", {
  encoding: "utf8",
}).trim();
const url = `https://github.com/${repo}/actions/workflows/release.yml`;
console.log(`\nOpening ${url}`);
execSync(`open "${url}" || xdg-open "${url}" || echo "Visit: ${url}"`, { stdio: "inherit" });
