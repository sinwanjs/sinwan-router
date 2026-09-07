import { $ } from "bun";
import { rm } from "node:fs/promises";
import { sinwan } from "bun-plugin-sinwan";

const ROOT = import.meta.dir;
const DIST = `${ROOT}/dist`;

async function cleanDist(): Promise<void> {
  console.log("Cleaning dist/");
  await rm(DIST, { recursive: true, force: true });
}

async function emitDeclarations(): Promise<void> {
  console.log("Emitting type declarations");
  await $`bunx tsc -p tsconfig.build.json`.cwd(ROOT);
}

async function buildBundle(): Promise<void> {
  console.log("Bundling with Bun.build + sinwan compiler");
  const result = await Bun.build({
    entrypoints: [`${ROOT}/src/index.ts`],
    outdir: DIST,
    root: `${ROOT}/src`,
    target: "browser",
    sourcemap: "linked",
    plugins: [sinwan()],
    // External: the consumer app provides its own Sinwan runtime.
    // Bundling a second copy would break reactivity (separate signal/effect
    // instances) and bloat the output.
    external: ["sinwan", "sinwan/reactivity", "sinwan/component"],
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error("Bun.build failed");
  }
}

async function main(): Promise<void> {
  await cleanDist();
  await emitDeclarations();
  await buildBundle();
  console.log("Build complete -> dist/");
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
