import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { toast } from "sonner";
import { Button } from "./button";
import { Toaster } from "./sonner";

/**
 * Toasts report what just happened ("Saved jane@acme.com.", "Deleted receipt.pdf."). The
 * app has one <Toaster> in its root layout; call `toast.success`, `toast.error` or
 * `toast.warning` from anywhere.
 */
const meta = {
  title: "Feedback/Toast",
  component: Toaster,
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Kinds: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => toast.success("Invitation sent.")}>
        Success
      </Button>
      <Button variant="outline" onClick={() => toast.error("Couldn't send the invitation. Try again.")}>
        Error
      </Button>
      <Button variant="outline" onClick={() => toast.warning("Invited 3 people. 1 added, but their email failed: resend it.")}>
        Warning
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.success("Password changed.", { description: "Other devices have been signed out." })}
      >
        With description
      </Button>
    </div>
  ),
};
