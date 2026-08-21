import assert from "node:assert/strict";
import puppeteer from "puppeteer";
import { browserLaunchOptions } from "./browser-launch.mjs";

const webUrl = process.env.EDUSYSTEM_TEST_WEB_URL;
if (!webUrl) throw new Error("Defina EDUSYSTEM_TEST_WEB_URL para executar o smoke test");
const stickyText = `Planejamento da aula ${Date.now()}`;

const browser = await puppeteer.launch(browserLaunchOptions());
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 1 });
  await page.goto(webUrl, { waitUntil: "networkidle0" });
  await page.locator('input[placeholder="seu usuário ou e-mail"]').fill("prof.teste");
  await page.locator('input[type="password"]').fill("Senha123");
  await page.locator("label.check input").click();
  await page.locator("button.full").click();
  await page.waitForSelector(".topbar");
  const tour = await page
    .waitForSelector(".onboarding-tour", { timeout: 1500 })
    .catch(() => null);
  if (tour) await page.locator(".onboarding-close").click();
  await page.evaluate(() => {
    window.location.hash = "#/quadro";
  });
  await page.waitForSelector(".advanced-canvas .konvajs-content");

  const dimensions = await page.evaluate(() => {
    const host = document.querySelector(".advanced-canvas").getBoundingClientRect();
    const stage = document.querySelector(".konvajs-content").getBoundingClientRect();
    return { hostWidth: host.width, stageWidth: stage.width };
  });
  assert.ok(Math.abs(dimensions.hostWidth - dimensions.stageWidth) < 2);
  assert.equal(
    await page.$('button[title="Conectar objetos"]'),
    null,
    "o botão de conector separado não deve existir",
  );

  const canvas = await (await page.$(".advanced-canvas")).boundingBox();
  const stageCanvas = await (await page.$(".konvajs-content")).boundingBox();
  await page.locator('button[title="Post-it editável"]').click();
  await page.mouse.move(stageCanvas.x + 180, stageCanvas.y + 190);
  await page.mouse.down();
  await page.mouse.move(stageCanvas.x + 390, stageCanvas.y + 325, { steps: 8 });
  await page.mouse.up();
  await page.waitForSelector(".inline-text-editor textarea");
  const editor = page.locator(".inline-text-editor textarea");
  await editor.fill(stickyText);
  await page.keyboard.down("Control");
  await page.keyboard.press("Enter");
  await page.keyboard.up("Control");
  await page.waitForSelector(".inline-text-editor", { hidden: true });
  await page.waitForFunction(
    () =>
      document
        .querySelector('button[aria-label="Selecionar, mover e redimensionar"]')
        ?.getAttribute("aria-pressed") === "true",
  );

  // O post-it deve permanecer selecionável e arrastável após a edição.
  await page.mouse.click(stageCanvas.x + 720, stageCanvas.y + 470);
  await page.waitForFunction(() =>
    document.querySelector(".board-footer")?.textContent.includes("Seta: selecione"),
  );
  await page.mouse.click(stageCanvas.x + 285, stageCanvas.y + 258);
  await page.waitForFunction(() =>
    document.querySelector(".board-footer")?.textContent.includes("Use os pontos"),
  );
  await page.mouse.move(stageCanvas.x + 285, stageCanvas.y + 258);
  await page.mouse.down();
  await page.mouse.move(stageCanvas.x + 430, stageCanvas.y + 353, { steps: 10 });
  await page.mouse.up();

  // A ferramenta de seleção também deve criar conexões pelos pontos laterais.
  await page.locator('button[title="Retângulo"]').click();
  await page.mouse.move(stageCanvas.x + 60, stageCanvas.y + 380);
  await page.mouse.down();
  await page.mouse.move(stageCanvas.x + 180, stageCanvas.y + 480, { steps: 6 });
  await page.mouse.up();
  await page.mouse.move(stageCanvas.x + 600, stageCanvas.y + 360);
  await page.mouse.down();
  await page.mouse.move(stageCanvas.x + 720, stageCanvas.y + 480, { steps: 6 });
  await page.mouse.up();
  await page.locator('button[aria-label="Selecionar, mover e redimensionar"]').click();
  await page.mouse.click(stageCanvas.x + 120, stageCanvas.y + 430);
  await page.mouse.move(stageCanvas.x + 180, stageCanvas.y + 430);
  await page.mouse.down();
  await page.mouse.move(stageCanvas.x + 600, stageCanvas.y + 420, { steps: 12 });
  await page.mouse.up();

  const beforeZoom = await page.$eval(".zoom-label", (node) => node.textContent);
  await page.mouse.move(
    stageCanvas.x + stageCanvas.width / 2,
    stageCanvas.y + stageCanvas.height / 2,
  );
  await page.keyboard.down("Control");
  await page.mouse.wheel({ deltaY: -120 });
  await page.keyboard.up("Control");
  await page.waitForFunction(
    (previous) => document.querySelector(".zoom-label")?.textContent !== previous,
    {},
    beforeZoom,
  );

  await page.locator(".heading-actions .btn-primary").click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".toast")].some((node) =>
      node.textContent.includes("Quadro salvo"),
    ),
  );

  const saved = await page.evaluate(async () => {
    const user = JSON.parse(sessionStorage.getItem("gestao_user"));
    const apiPort = new URLSearchParams(location.search).get("apiPort");
    const response = await fetch(`http://127.0.0.1:${apiPort}/api/quadros`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    return response.json();
  });
  assert.equal(saved.length, 1);
  assert.ok(saved[0].dados_json.includes(stickyText));
  const savedStage = JSON.parse(saved[0].dados_json);
  const sticky = savedStage.children[0].children.find(
    (node) =>
      node.attrs.shapeType === "sticky" &&
      node.attrs.text === stickyText,
  );
  assert.ok(sticky.attrs.x > 250, "o post-it precisa persistir na nova posição");
  const connector = savedStage.children[0].children.find(
    (node) => node.attrs.shapeType === "connector",
  );
  assert.ok(connector, "a seleção deve criar um conector entre objetos");
  assert.equal(connector.attrs.fromSide, "right");
  assert.equal(connector.attrs.toSide, "left");

  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector('input[placeholder="seu usuário ou e-mail"]');
  const remembered = await page.$eval(
    'input[placeholder="seu usuário ou e-mail"]',
    (input) => input.value,
  );
  const passwordAfterReload = await page.$eval(
    'input[type="password"]',
    (input) => input.value,
  );
  assert.equal(remembered, "prof.teste");
  assert.equal(passwordAfterReload, "");
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("gestao_user")),
    null,
  );
  console.log(
    "ui smoke: login obrigatório, onboarding, canvas responsivo, post-it, conexão, zoom e persistência ok",
  );
} finally {
  await browser.close();
}
