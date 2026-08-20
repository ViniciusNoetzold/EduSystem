import { app, BrowserWindow, dialog } from "electron";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import net from "node:net";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let backend;
let apiOrigin;

function findAvailablePort(start = 3333) {
  return new Promise((resolve, reject) => {
    const probe = (port) => {
      const server = net.createServer();
      server.unref();
      server.once("error", (error) =>
        error.code === "EADDRINUSE" ? probe(port + 1) : reject(error),
      );
      server.listen(port, "127.0.0.1", () => server.close(() => resolve(port)));
    };
    probe(start);
  });
}

function resolveDataDirectory() {
  const preferred = path.join(process.env.SystemDrive || "C:", "EduSystem");
  const fallback = path.join(app.getPath("userData"), "data");
  try {
    fs.mkdirSync(preferred, { recursive: true });
    for (const folder of [
      "dados",
      "relatorios",
      "importacoes",
      "anexos",
      "backups",
    ]) {
      fs.mkdirSync(path.join(preferred, folder), { recursive: true });
    }
    const target = path.join(preferred, "dados");
    const oldDatabase = path.join(fallback, "database.sqlite");
    if (
      !fs.existsSync(path.join(target, "database.sqlite")) &&
      fs.existsSync(oldDatabase)
    ) {
      for (const file of [
        "database.sqlite",
        "database.sqlite-wal",
        "database.sqlite-shm",
      ]) {
        const source = path.join(fallback, file);
        if (fs.existsSync(source))
          fs.copyFileSync(source, path.join(target, file));
      }
    }
    return target;
  } catch {
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

function startBackend(port) {
  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, "server", "index.js")
    : path.join(__dirname, "..", "server", "index.js");
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    PORT: String(port),
    EDUSYSTEM_DATA_DIR: resolveDataDirectory(),
  };
  if (!app.isPackaged)
    env.PUPPETEER_CACHE_DIR = path.join(
      __dirname,
      "..",
      "server",
      "puppeteer-cache",
    );
  backend = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env,
    stdio: "ignore",
    windowsHide: true,
  });
  backend.on("error", (error) =>
    dialog.showErrorBox(
      "EduSystem API",
      `Não foi possível iniciar o banco/API.\n${error.message}`,
    ),
  );
  backend.on("exit", (code) => {
    if (code && !app.isQuitting)
      dialog.showErrorBox(
        "EduSystem API",
        `A API foi encerrada inesperadamente (código ${code}).`,
      );
  });
}

async function waitForBackend(timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if ((await fetch(`${apiOrigin}/api/health`)).ok) return true;
    } catch {
      /* processo iniciando */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function createWindow(port) {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar", "assets", "icon.png")
    : path.join(__dirname, "assets", "icon.png");
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#090b10",
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  if (app.isPackaged)
    await win.loadFile(
      path.join(process.resourcesPath, "web", "dist", "index.html"),
      { query: { apiPort: String(port) } },
    );
  else await win.loadURL("http://localhost:5173");
  return win;
}

app.isQuitting = false;
app.setAppUserModelId("com.edusystem.gestao");
app.whenReady().then(async () => {
  const port = await findAvailablePort();
  apiOrigin = `http://127.0.0.1:${port}`;
  startBackend(port);
  if (!(await waitForBackend())) {
    dialog.showErrorBox(
      "EduSystem",
      "O banco de dados e a API local não responderam em 15 segundos.",
    );
    app.quit();
    return;
  }
  await createWindow(port);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
  });
});
app.on("before-quit", () => {
  app.isQuitting = true;
  if (backend) backend.kill();
});
app.on("window-all-closed", () => {
  if (backend) backend.kill();
  if (process.platform !== "darwin") app.quit();
});
