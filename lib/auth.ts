import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { readSession, SESSION_COOKIE } from "@/lib/session";

/** The signed-in user (fresh from the database, so role changes apply immediately), or null. */
export const getCurrentUser = cache(async () => {
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, role: true },
  });
});

/** Use in backstore pages and actions. Anyone who is not an ADMIN is sent to the login page. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/backstore/login");
  return user;
}
