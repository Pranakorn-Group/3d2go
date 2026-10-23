"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run, UserError } from "@/lib/action";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";

const password = z.string().min(8, "Password must be at least 8 characters");
const role = z.enum(["USER", "ADMIN"]);

const createSchema = z.object({
  email: z.email("Enter a valid email").trim().toLowerCase(),
  name: z
    .string()
    .trim()
    .transform((v) => v || null)
    .optional(),
  password,
  role: role.default("USER"),
});

export async function createUser(input: z.input<typeof createSchema>) {
  return run(async () => {
    await requireAdmin();
    const { password, ...data } = createSchema.parse(input);
    await prisma.user.create({ data: { ...data, passwordHash: hashPassword(password) } });
    revalidatePath("/backstore/users");
  });
}

export async function setUserRole(id: string, newRole: "USER" | "ADMIN") {
  return run(async () => {
    const me = await requireAdmin();
    // Blocking self-changes also guarantees at least one admin always remains.
    if (me.id === id) throw new UserError("You can't change your own role");
    await prisma.user.update({ where: { id }, data: { role: role.parse(newRole) } });
    revalidatePath("/backstore/users");
  });
}

export async function resetPassword(id: string, newPassword: string) {
  return run(async () => {
    await requireAdmin();
    await prisma.user.update({ where: { id }, data: { passwordHash: hashPassword(password.parse(newPassword)) } });
  });
}
