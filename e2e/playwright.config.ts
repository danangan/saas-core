import { defineConfig } from "@playwright/test";
import { config } from "./libs/config/config.ts";

export default defineConfig(config.toPlayWrightConfig());
