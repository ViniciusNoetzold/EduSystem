import fs from "node:fs";

const browserCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

export function browserLaunchOptions() {
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH || browserCandidates.find(fs.existsSync);
  return executablePath ? { headless: true, executablePath } : { headless: true };
}
