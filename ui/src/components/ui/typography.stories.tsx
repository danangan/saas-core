import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PlusIcon } from "lucide-react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Heading, PageHeader, SectionHeader, Text } from "./typography";

const meta = {
  title: "Foundations/Typography",
  component: Heading,
  parameters: {
    docs: {
      description: {
        component:
          "The app's text scale. A page has one `PageHeader` (its `<h1>`); sections use `SectionHeader` or `Heading level={2}`; body copy uses `Text`.",
      },
    },
  },
} satisfies Meta<typeof Heading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Headings: Story = {
  args: { children: "Heading" },
  render: () => (
    <div className="flex flex-col gap-3">
      <Heading level={1}>Level 1: page title</Heading>
      <Heading level={2}>Level 2: section</Heading>
      <Heading level={3}>Level 3: group within a section</Heading>
    </div>
  ),
};

export const TextVariants: Story = {
  args: { children: "" },
  render: () => (
    <div className="flex max-w-prose flex-col gap-3">
      <Text variant="lead">Lead: an introduction under a big title.</Text>
      <Text>Default: body copy. Invited users can sign in once they set a password.</Text>
      <Text variant="muted">Muted: supporting text, like a description under a heading.</Text>
      <Text variant="small">Small: captions and timestamps.</Text>
    </div>
  ),
};

export const Page: StoryObj<typeof PageHeader> = {
  render: (args) => <PageHeader {...args} />,
  args: {
    title: "Companies",
    description: "Companies using SaaS Core and their users.",
    actions: (
      <Button>
        <PlusIcon data-icon="inline-start" />
        Add company
      </Button>
    ),
  },
};

export const PageWithBadge: StoryObj<typeof PageHeader> = {
  render: (args) => <PageHeader {...args} />,
  args: {
    title: "Acme Corp",
    badge: <Badge variant="secondary">Active</Badge>,
    description: "Slug acme-corp · Created 3 Nov 2026",
    actions: <Button variant="outline">Rename</Button>,
  },
};

export const Section: StoryObj<typeof SectionHeader> = {
  render: (args) => <SectionHeader {...args} />,
  args: {
    title: "Users",
    actions: (
      <>
        <Button variant="outline">Invite several</Button>
        <Button>Add user</Button>
      </>
    ),
  },
};
