import { test as setup } from "@playwright/test";

// Wait until all pages are compiled for local mode

const PAGES = [
  "/",
  "/login",
  "/login/warmup",
  "/forgot-password",
  "/reset-password",
  "/signup",
  "/home",
  "/team",
  "/settings",
  "/admin/login",
  "/admin",
];

setup("compile the pages", async ({ page }) => {
  setup.setTimeout(120_000);
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
});
