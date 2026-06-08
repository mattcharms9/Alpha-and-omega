import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { toSafeErrorMessage } from "@/lib/errors";

const RegisterSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as unknown;
    const { name, email, password } = RegisterSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ success: false, error: "Email already in use." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({ data: { name, email, passwordHash } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
    }
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
