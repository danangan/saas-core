import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { UsersIcon } from "lucide-react";
import { fn } from "storybook/test";
import { Button } from "./button";
import { Spinner } from "./spinner";
import { EmptyState, ErrorState, LoadingState } from "./states";

const meta = {
  title: "Feedback/States",
  component: LoadingState,
  parameters: {
    docs: {
      description: {
        component:
          "What a page or section shows while it loads (`loading.tsx` uses `LoadingState`), when it has nothing (`EmptyState`), and when it fails (`error.tsx` uses `ErrorState`).",
      },
    },
  },
} satisfies Meta<typeof LoadingState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {};

export const LoadingWithLabel: Story = { args: { label: "Loading the team…" } };

export const Empty: StoryObj<typeof EmptyState> = {
  render: (args) => <EmptyState {...args} />,
  args: {
    icon: <UsersIcon />,
    title: "No users yet",
    description: "Invite your team to get started.",
    action: <Button variant="outline">Invite users</Button>,
  },
};

export const Failed: StoryObj<typeof ErrorState> = {
  render: (args) => <ErrorState {...args} />,
  args: { onRetry: fn() },
};

/** The spinner on its own: decorative unless it has a label. */
export const Spinners: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner />
      <Spinner className="size-6" />
      <Spinner className="size-8 text-muted-foreground" label="Loading" />
    </div>
  ),
};
