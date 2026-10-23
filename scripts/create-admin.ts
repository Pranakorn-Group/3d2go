// Creates an ADMIN account, or promotes an existing account to ADMIN and sets its password.
// Usage: pnpm create-admin you@example.com "your-password" ["Your name"]
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { hashPassword } from "../lib/password";

async function main() {
  const [rawEmail, password, name] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  if (!email || !password) {
    console.error('Usage: pnpm create-admin you@example.com "your-password" ["Your name"]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters");
    process.exit(1);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const passwordHash = hashPassword(password);
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name: name || null, passwordHash, role: "ADMIN" },
      update: { passwordHash, role: "ADMIN", ...(name ? { name } : {}) },
    });
    console.log(`${user.email} is an admin. Sign in at /backstore/login`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
