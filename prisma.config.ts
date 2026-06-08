import path from "node:path";
import { defineConfig } from "prisma/config";
import "dotenv/config";

// Dual-mode: SQLite for local dev, PostgreSQL for production
// Set DATABASE_URL to a postgresql:// string to activate PostgreSQL mode
const isPostgres =
  process.env.DATABASE_URL?.startsWith("postgresql://") ||
  process.env.DATABASE_URL?.startsWith("postgres://");

export default defineConfig({
  schema: path.join(__dirname, "prisma/schema.prisma"),
  migrations: {
    path: path.join(__dirname, "prisma/migrations"),
  },
  datasource: {
    url: isPostgres
      ? process.env.DATABASE_URL!
      : `file:${path.join(__dirname, "prisma/dev.db")}`,
  },
});
