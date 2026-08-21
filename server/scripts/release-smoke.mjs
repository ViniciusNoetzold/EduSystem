import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(scriptsDir, "..");
const repoDir = path.resolve(serverDir, "..");
const webDir = path.join(repoDir, "web");
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "edusystem-release-smoke-"));
const children = [];

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitFor(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* processo iniciando */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Tempo esgotado aguardando ${url}`);
}

function runScript(name, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(scriptsDir, name)], {
      cwd: serverDir,
      env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${name} encerrou com código ${code}`)),
    );
  });
}

try {
  const apiPort = await freePort();
  const webPort = await freePort();
  const env = {
    ...process.env,
    PORT: String(apiPort),
    EDUSYSTEM_DATA_DIR: dataDir,
    JWT_SECRET: "release-smoke-secret",
    EDUSYSTEM_TEST_WEB_URL: `http://127.0.0.1:${webPort}/?apiPort=${apiPort}`,
  };

  const apiProcess = spawn(process.execPath, [path.join(serverDir, "index.js")], {
    cwd: serverDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(apiProcess);
  apiProcess.stdout.pipe(process.stdout);
  apiProcess.stderr.pipe(process.stderr);

  const webProcess = spawn(
    process.execPath,
    [
      path.join(webDir, "node_modules", "vite", "bin", "vite.js"),
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(webPort),
    ],
    { cwd: webDir, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  children.push(webProcess);
  webProcess.stdout.pipe(process.stdout);
  webProcess.stderr.pipe(process.stderr);

  await Promise.all([
    waitFor(`http://127.0.0.1:${apiPort}/api/health`),
    waitFor(`http://127.0.0.1:${webPort}`),
  ]);
  await runScript("first-access-smoke.mjs", env);
  await runScript("ui-smoke.mjs", env);
  console.log("release smoke: fluxo completo aprovado em banco temporário limpo");
} finally {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
  await fs.rm(dataDir, { recursive: true, force: true });
}
