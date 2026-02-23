import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { jwtVerify } from "jose"

export async function POST(req: Request) {
  const { token, password } = await req.json()

  if (!token || typeof token !== "string" || !password || typeof password !== "string") {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 })
  }

  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "development-secret"
  let userId = ""

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    if (payload.purpose !== "password-reset" || typeof payload.sub !== "string" || !payload.sub) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 })
    }
    userId = payload.sub
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: userId },
    data: { password: await bcrypt.hash(password, 10) },
  })

  return NextResponse.json({ ok: true })
}
