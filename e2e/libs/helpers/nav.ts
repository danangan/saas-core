import type { Locator, Page } from "@playwright/test";

/** A link in the app's sidebar, not one of the same name on the page (e.g. the Home page's shortcuts). */
export const navLink = (page: Page, name: string): Locator =>
  page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name });
