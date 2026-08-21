import assert from "node:assert/strict";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(scriptsDir, "..", "..");
const executable =
  process.env.EDUSYSTEM_PACKAGED_EXE ||
  path.join(repoDir, "desktop", "dist-final", "win-unpacked", "EduSystem.exe");
if (!fs.existsSync(executable))
  throw new Error(`Executável empacotado não encontrado: ${executable}`);

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

async function waitForDebugger(port, child, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (child.exitCode !== null)
      throw new Error(`EduSystem empacotado encerrou com código ${child.exitCode}`);
    try {
      if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) return;
    } catch {
      /* Electron iniciando */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("O depurador do executável empacotado não respondeu");
}

function waitForExit(child, timeoutMs = 5000) {
  if (child.exitCode !== null) return Promise.resolve();
  return Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

async function removeDirectory(directory) {
  let lastError;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await fsPromises.rm(directory, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError;
}

const dataDir = await fsPromises.mkdtemp(
  path.join(os.tmpdir(), "edusystem-packaged-smoke-"),
);
const debugPort = await freePort();
const portable = path.basename(executable).includes("-Portable-");
const child = spawn(executable, [`--remote-debugging-port=${debugPort}`], {
  cwd: path.dirname(executable),
  env: { ...process.env, EDUSYSTEM_DATA_DIR: dataDir },
  stdio: ["ignore", "pipe", "pipe"],
});
let browser;
let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk;
});
child.stderr.on("data", (chunk) => {
  output += chunk;
});

try {
  await waitForDebugger(debugPort, child, portable ? 120000 : 30000);
  browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${debugPort}`,
  });
  const target = await browser.waitForTarget(
    (item) =>
      item.type() === "page" &&
      item.url().startsWith("file:") &&
      item.url().includes("index.html"),
    { timeout: portable ? 120000 : 40000 },
  );
  const page = await target.page();
  await page.waitForSelector(".login-card h1", { timeout: 40000 });
  assert.equal(
    await page.$eval(".login-card h1", (node) => node.textContent.trim()),
    "Primeiro acesso",
  );
  await page.locator('input[name="fullName"]').fill("Diretor Empacotado");
  await page.locator('input[name="username"]').fill("diretor.empacotado");
  await page
    .locator('input[name="identifier"]')
    .fill("diretor.empacotado@edusystem.local");
  await page.locator('input[name="password"]').fill("Senha123");
  await page.locator('input[name="passwordConfirmation"]').fill("Senha123");
  await page.locator("button.full").click();
  await page.waitForSelector(".topbar");
  assert.equal(
    await page.$eval(".user-meta small", (node) => node.textContent.trim()),
    "Diretor",
  );
  assert.ok(fs.existsSync(path.join(dataDir, "database.sqlite")));
  await page.evaluate(() => window.close());
  browser.disconnect();
  browser = null;
  await waitForExit(child, portable ? 15000 : 5000);
  console.log(
    `packaged smoke: ${portable ? "portátil" : "Electron"}, primeiro acesso e SQLite empacotado ok`,
  );
} catch (error) {
  if (output.trim()) console.error(output.trim());
  throw error;
} finally {
  if (browser) {
    const pages = await browser.pages().catch(() => []);
    await Promise.all(pages.map((page) => page.close().catch(() => {})));
    browser.disconnect();
  }
  if (child.exitCode === null) child.kill();
  await waitForExit(child, portable ? 15000 : 5000);
  await removeDirectory(dataDir);
}
