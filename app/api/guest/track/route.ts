import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

type GuestTrackRequest = {
  guestId?: string
}

function isMissingGuestUserTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false
  }

  const err = error as { code?: string; message?: string }
  return err.code === "P2021" && String(err.message || "").includes("GuestUser")
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GuestTrackRequest
    const guestId = String(body?.guestId || "").trim()

    if (!guestId || !guestId.startsWith("guest_") || guestId.length > 128) {
      return NextResponse.json({ error: "INVALID_GUEST_ID" }, { status: 400 })
    }

    await prisma.guestUser.upsert({
      where: { guestId },
      create: {
        guestId,
        docsGenerated: 1,
      },
      update: {
        docsGenerated: { increment: 1 },
        lastActiveAt: new Date(),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (isMissingGuestUserTableError(error)) {
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "TRACK_FAILED" }, { status: 500 })
  }
}
