import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

// In dev the client is kept on globalThis so hot reloads don't open new connections. The cached
// client is only reused while it came from the current generated code: after `prisma generate`
// (e.g. a new model) the PrismaClient class changes and a fresh client is created.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaClass?: typeof PrismaClient;
};

function createClient() {
  const max = Number(process.env.DATABASE_POOL_MAX) || undefined;
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max });
  return new PrismaClient({ adapter });
}

function getClient() {
  const cached = globalForPrisma.prisma;
  if (cached && globalForPrisma.prismaClass === PrismaClient) return cached;
  void cached?.$disconnect();
  return createClient();
}

export const prisma = getClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaClass = PrismaClient;
}
