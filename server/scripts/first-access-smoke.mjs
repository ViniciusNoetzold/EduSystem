import assert from "node:assert/strict";
import puppeteer from "puppeteer";
import { browserLaunchOptions } from "./browser-launch.mjs";

const webUrl = process.env.EDUSYSTEM_TEST_WEB_URL;
if (!webUrl) throw new Error("Defina EDUSYSTEM_TEST_WEB_URL para executar o smoke test");

const browser = await puppeteer.launch(browserLaunchOptions());
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 1 });
  await page.goto(webUrl, { waitUntil: "networkidle0" });
  await page.waitForFunction(
    () => document.querySelector(".login-card h1")?.textContent.includes("Primeiro acesso"),
  );

  assert.equal(
    await page.$eval(".login-card h1", (node) => node.textContent.trim()),
    "Primeiro acesso",
  );
  await page.locator('input[name="fullName"]').fill("Professor Teste");
  await page.locator('input[name="username"]').fill("prof.teste");
  await page.locator('input[name="identifier"]').fill("prof.teste@edusystem.local");
  await page.locator('input[name="password"]').fill("Senha123");
  await page.locator('input[name="passwordConfirmation"]').fill("Senha123");
  await page.locator("button.full").click();
  await page.waitForSelector(".topbar");
  assert.equal(
    await page.$eval(".user-meta small", (node) => node.textContent.trim()),
    "Diretor",
  );

  const tour = await page
    .waitForSelector(".onboarding-tour", { timeout: 2000 })
    .catch(() => null);
  if (tour) await page.locator(".onboarding-close").click();

  await page.locator(".side-bottom button").click();
  await page.waitForSelector(".first-access-link");
  await page.locator(".first-access-link").click();
  await page.waitForFunction(() =>
    document
      .querySelector(".form-error")
      ?.textContent.includes("já possui uma conta"),
  );

  console.log(
    "first access smoke: banco vazio, criação do diretor e opção explícita no login ok",
  );
} finally {
  await browser.close();
}
