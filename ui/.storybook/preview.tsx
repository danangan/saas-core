import type { Preview } from "@storybook/nextjs-vite";
import { Toaster } from "../src/components/ui/sonner";
import "../src/app/globals.css";
import { fontVariables } from "../src/lib/fonts";

const preview: Preview = {
  parameters: {
    layout: "padded",
    controls: { expanded: true, matchers: { color: /(background|color)$/i } },
    a11y: { test: "error" },
    options: {
      storySort: {
        order: ["Introduction", "Foundations", "Components", "Feedback", "Forms", "Overlays"],
      },
    },
  },
  // The same page background and text colour as the app; a toaster for stories that toast.
  decorators: [
    (Story) => (
      // The app's fonts (next/font), as on its <html>.
      <div className={`${fontVariables} bg-background font-sans text-foreground antialiased`}>
        <Story />
        <Toaster position="top-center" />
      </div>
    ),
  ],
  tags: ["autodocs"],
};

export default preview;
