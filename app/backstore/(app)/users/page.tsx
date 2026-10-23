import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UsersView } from "./users-view";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requireAdmin();
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
  return <UsersView meId={me.id} users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))} />;
}
