import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { email, password } = await req.json()

  if (!email || !password)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  const normalizedEmail = String(email).trim().toLowerCase()

  if (!normalizedEmail.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 })
  }

  const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (exists)
    return NextResponse.json({ error: "User exists" }, { status: 409 })

  const hash = await bcrypt.hash(password, 10)

  await prisma.user.create({
    data: { email: normalizedEmail, password: hash },
  })

  return NextResponse.json({ ok: true })
}
