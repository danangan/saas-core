import type { StorybookConfig } from "@storybook/nextjs-vite";
import tailwindcss from "@tailwindcss/vite";

/**
 * Storybook for the UI components (pnpm --filter @saas-core/ui storybook). Stories live next
 * to their components as *.stories.tsx; the Introduction page is in ./introduction.mdx.
 */
const config: StorybookConfig = {
  stories: ["./*.mdx", "../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: { name: "@storybook/nextjs-vite", options: {} },
  core: { disableTelemetry: true },
  // Tailwind v4 through Vite (the app itself builds it with Turbopack).
  viteFinal: async (vite) => ({ ...vite, plugins: [...(vite.plugins ?? []), tailwindcss()] }),
};

export default config;
