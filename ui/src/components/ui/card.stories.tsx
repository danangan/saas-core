import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

const meta = {
  title: "Components/Card",
  component: Card,
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>You&apos;ll stay signed in here and be signed out everywhere else.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm">
            Help
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="text-sm">The card&apos;s content: usually a form or a list.</CardContent>
      <CardFooter>
        <Button>Change password</Button>
      </CardFooter>
    </Card>
  ),
};
