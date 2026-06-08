import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  // pg.Pool is lazy — it does NOT connect at construction, only on first query.
  // This means the build passes even when DATABASE_URL is a SQLite path or unset;
  // actual queries will fail until DATABASE_URL is set to a real postgresql:// URL.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgresql://localhost:5432/dev",
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
