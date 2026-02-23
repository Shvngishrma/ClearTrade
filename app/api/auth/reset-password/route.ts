import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { token, password } = await req.json()

  const record = await prisma.passwordReset.findUnique({ where: { token } })
  if (!record || record.expiresAt < new Date())
    return NextResponse.json({ error: "Invalid token" }, { status: 400 })

  await prisma.user.update({
    where: { id: record.userId },
    data: { password: await bcrypt.hash(password, 10) },
  })

  await prisma.passwordReset.delete({ where: { token } })

  return NextResponse.json({ ok: true })
}
