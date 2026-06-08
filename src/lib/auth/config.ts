import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
};
