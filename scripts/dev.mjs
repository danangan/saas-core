// Runs the dev processes and makes sure they all stop when it does.
//
//   node scripts/dev.mjs              # api, worker, ui (`pnpm dev`)
//   node scripts/dev.mjs api worker   # just those (`pnpm --filter @saas-core/backend dev`)
//
// pnpm doesn't pass signals on to the scripts it runs, so stopping `pnpm dev` by
// signalling only pnpm (as some terminals and IDEs do) used to leave these processes
// running. This runner stops them in either case: on a signal, and when its parent
// (pnpm) goes away. Each process then shuts down cleanly; a second Ctrl+C forces it.
import concurrently from "concurrently";
import { fileURLToPath } from "node:url";

const web = fileURLToPath(new URL("..", import.meta.url));
const all = {
  api: { cwd: "backend", command: "exec ./node_modules/.bin/tsx watch --env-file=.env src/api/main.ts", prefixColor: "blue" },
  worker: { cwd: "backend", command: "exec ./node_modules/.bin/tsx watch --env-file=.env src/worker/main.ts", prefixColor: "magenta" },
  ui: { cwd: "ui", command: "exec ./node_modules/.bin/next dev", prefixColor: "green" },
};

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(all);
for (const name of names) if (!all[name]) throw new Error(`Unknown process "${name}". Choose from: ${Object.keys(all).join(", ")}`);

const { commands, result } = concurrently(
  names.map((name) => ({ name, ...all[name], cwd: `${web}/${all[name].cwd}` })),
  // Ctrl+C reaches every process directly (same process group); the runner forwards
  // signals sent only to it. Anything still running after 25 s is killed.
  { killSignal: "SIGINT", killTimeout: 25_000, handleInput: false },
);

let stopping = false;
function stopAll(reason) {
  if (stopping) return;
  stopping = true;
  console.info(`[dev] ${reason}: stopping ${names.join(", ")}`);
  for (const command of commands) command.kill("SIGINT");
}

const parent = process.ppid;
const watchParent = setInterval(() => {
  if (process.ppid !== parent) stopAll("pnpm exited");
}, 500);

result.then(
  () => process.exit(0),
  () => process.exit(stopping ? 0 : 1),
).finally(() => clearInterval(watchParent));
