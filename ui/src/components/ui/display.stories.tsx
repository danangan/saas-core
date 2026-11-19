import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Progress } from "./progress";
import { ScrollArea } from "./scroll-area";
import { Separator } from "./separator";
import { Skeleton } from "./skeleton";

const meta = {
  title: "Components/Display",
  component: Progress,
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Progress. Give it a label when nothing else names it. */
export const ProgressBar: Story = {
  args: { value: 60, "aria-label": "Saving changes" },
  render: (args) => (
    <div className="max-w-sm">
      <Progress {...args} />
    </div>
  ),
};

/** Placeholders while a part of the page loads, shaped like what's coming. */
export const Skeletons: Story = {
  render: () => (
    <div className="flex max-w-sm flex-col gap-2">
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-5 w-1/3" />
    </div>
  ),
};

export const Separators: Story = {
  render: () => (
    <div className="flex max-w-sm flex-col gap-3 text-sm">
      <span>Above</span>
      <Separator />
      <div className="flex h-5 items-center gap-3">
        <span>Left</span>
        <Separator orientation="vertical" />
        <span>Right</span>
      </div>
    </div>
  ),
};

export const ScrollingArea: Story = {
  render: () => (
    <ScrollArea className="h-40 max-w-sm rounded-md border">
      <ul className="p-3 text-sm">
        {Array.from({ length: 30 }, (_, i) => (
          <li key={i} className="py-1">
            Item {i + 1}
          </li>
        ))}
      </ul>
    </ScrollArea>
  ),
};
