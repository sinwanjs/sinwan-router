import { $ } from "bun";
import { rm } from "node:fs/promises";
import { sinwan } from "bun-plugin-sinwan";

const ROOT = import.meta.dir;
const DIST = `${ROOT}/dist`;

const SINWAN_EXTERNALS = [
  "sinwan",
  "sinwan/reactivity",
  "sinwan/component",
  "sinwan/control-flow",
  "sinwan/jsx-runtime",
  "sinwan/jsx-dev-runtime",
  "sinwan/renderer",
] as const;

async function cleanDist(): Promise<void> {
  console.log("Cleaning dist/");
  await rm(DIST, { recursive: true, force: true });
}

async function emitDeclarations(): Promise<void> {
  console.log("Emitting type declarations");
  await $`bunx tsc -p tsconfig.build.json`.cwd(ROOT);
}

async function assertPeerExternal(): Promise<void> {
  const js = await Bun.file(`${DIST}/index.js`).text();
  if (js.includes("pendingEffects") || js.includes("/_chunks/")) {
    throw new Error(
      "sinwan-router dist inlined the Sinwan runtime; signals will not share with the app",
    );
  }
  if (!js.includes('from "sinwan/') && !js.includes("from 'sinwan/")) {
    throw new Error("sinwan-router dist is missing bare sinwan/* imports");
  }
}

async function buildBundle(): Promise<void> {
  console.log("Bundling with Bun.build + sinwan compiler");
  const result = await Bun.build({
    entrypoints: [`${ROOT}/src/index.ts`],
    outdir: DIST,
    root: `${ROOT}/src`,
    target: "browser",
    sourcemap: "linked",
    plugins: [
      sinwan({
        peerExternal: true,
        dev: false,
        derivedLocals: true,
        hoist: true,
      }),
    ],
    external: [...SINWAN_EXTERNALS],
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error("Bun.build failed");
  }
  await assertPeerExternal();
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
