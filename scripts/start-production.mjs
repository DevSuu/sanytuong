import { cp } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

// Load dotenv optionally (available in local dev/host runs; environment variables are passed directly in Docker)
try {
  await import("dotenv/config");
} catch {
  // Dotenv is not needed in Docker where environment variables are injected directly
}

const root = new URL("../", import.meta.url);
const standaloneServer = new URL(".next/standalone/server.js", root);
const rootServer = new URL("server.js", root);

let targetServerPath;

if (existsSync(fileURLToPath(standaloneServer))) {
  // Local host run after next build: sync static assets into standalone structure
  await cp(new URL("public", root), new URL(".next/standalone/public", root), {
    recursive: true,
  }).catch(() => {});
  await cp(
    new URL(".next/static", root),
    new URL(".next/standalone/.next/static", root),
    { recursive: true },
  ).catch(() => {});
  targetServerPath = fileURLToPath(standaloneServer);
} else if (existsSync(fileURLToPath(rootServer))) {
  // Docker container run where standalone files are placed in root /app
  targetServerPath = fileURLToPath(rootServer);
} else {
  throw new Error(
    "Next.js production server.js could not be located in .next/standalone/ or root.",
  );
}

const server = spawn(process.execPath, [targetServerPath], {
  stdio: "inherit",
  windowsHide: true,
  env: {
    ...process.env,
    HOSTNAME: process.env.HOSTNAME ?? "0.0.0.0",
    PORT: process.env.PORT ?? "3000",
  },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}

server.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
