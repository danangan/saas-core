import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Alert, ErrorAlert } from "./alert";

const meta = {
  title: "Feedback/Alert",
  component: Alert,
  args: { variant: "info", title: "Heads up", children: "Invitations expire after 7 days." },
  argTypes: { variant: { control: "select", options: ["info", "success", "warning", "destructive"] } },
  parameters: {
    docs: {
      description: {
        component:
          "A message in the page. Errors and warnings are announced to screen readers as they appear (`role=alert`); info and success politely (`role=status`). For a result of something the user just did, prefer a toast.",
      },
    },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex max-w-lg flex-col gap-3">
      <Alert variant="info" title="Pending invitations">
        3 people haven&apos;t accepted their invitation yet.
      </Alert>
      <Alert variant="success">Your password has been reset. Sign in with the new one.</Alert>
      <Alert variant="warning" title="Invitation expired">
        Resend it so they can sign up.
      </Alert>
      <Alert variant="destructive" title="Couldn't save">
        Could not reach the server. Check your connection and try again.
      </Alert>
    </div>
  ),
};

export const WithoutIcon: Story = { args: { icon: false, title: undefined } };

/** Renders nothing until there's an error, so it can sit in place. */
export const Error: StoryObj<typeof ErrorAlert> = {
  render: (args) => <ErrorAlert {...args} />,
  args: { error: "Incorrect username or password." },
};
