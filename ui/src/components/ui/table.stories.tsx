import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./badge";
import { Card } from "./card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "./table";

const meta = {
  title: "Components/Table",
  component: Table,
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const users = [
  { name: "Ann Lee", status: "Active", role: "Admin" },
  { name: "Bob Ray", status: "Invited", role: "Member" },
  { name: "Cat Moe", status: "Deactivated", role: "Member" },
];

export const InACard: Story = {
  render: () => (
    <Card className="py-0">
      <Table>
        <TableCaption className="pb-3">Users in this company</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="pr-4 text-right">Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((f) => (
            <TableRow key={f.name}>
              <TableCell className="pl-4 font-medium">{f.name}</TableCell>
              <TableCell>
                <Badge variant={f.status === "Deactivated" ? "destructive" : "secondary"}>{f.status}</Badge>
              </TableCell>
              <TableCell className="pr-4 text-right">{f.role}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  ),
};
