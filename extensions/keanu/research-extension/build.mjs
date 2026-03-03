import * as esbuild from "esbuild";

const isWatch = process.argv.includes("--watch");

const commonOptions = {
  bundle: true,
  minify: !isWatch,
  sourcemap: isWatch,
  target: "es2022",
  format: "esm",
};

const entryPoints = [
  { in: "src/background/service-worker.ts", out: "service-worker" },
  { in: "src/content/extractor.ts", out: "content" },
  { in: "src/sidepanel/panel.ts", out: "panel" },
  { in: "src/options/options.ts", out: "options" },
];

async function build() {
  for (const entry of entryPoints) {
    await esbuild.build({
      ...commonOptions,
      entryPoints: [entry.in],
      outfile: `build/${entry.out}.js`,
    });
  }
  console.log("Build complete");
}

async function watch() {
  const contexts = await Promise.all(
    entryPoints.map((entry) =>
      esbuild.context({
        ...commonOptions,
        entryPoints: [entry.in],
        outfile: `build/${entry.out}.js`,
      }),
    ),
  );

  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log("Watching for changes...");
}

if (isWatch) {
  watch();
} else {
  build();
}
