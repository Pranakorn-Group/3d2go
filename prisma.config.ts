import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations go over the direct connection when one is set (Neon's pooled URL can't hold migration locks).
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
