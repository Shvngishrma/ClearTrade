import { prisma } from "@/lib/db"
import { v4 as uuid } from "uuid"
import nodemailer from "nodemailer"
import { NextResponse } from "next/server"
import { SignJWT } from "jose"

export async function POST(req: Request) {
  const { email } = await req.json()

  if (!email || typeof email !== "string") {
    return NextResponse.json(
      { error: "INVALID_EMAIL", message: "Valid email is required." },
      { status: 400 }
    )
  }

  const normalizedEmail = email.trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  const isProduction = process.env.NODE_ENV === "production"

  if (!user) {
    return NextResponse.json(
      {
        error: "USER_NOT_FOUND",
        message: "No account found with this email. Please sign up first.",
        redirectToSignup: true,
      },
      { status: 404 }
    )
  }

  const smtpEmail = process.env.SMTP_EMAIL
  const smtpPassword = process.env.SMTP_PASSWORD
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = Number(process.env.SMTP_PORT || 587)
  const smtpSecure = String(process.env.SMTP_SECURE || "false") === "true"
  const smtpFrom = process.env.SMTP_FROM || smtpEmail
  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000"
  const hasPlaceholderSmtp =
    !smtpEmail ||
    !smtpPassword ||
    smtpEmail.includes("your@email.com") ||
    smtpPassword.includes("app-password")

  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "development-secret"
  const token = await new SignJWT({
    sub: user.id,
    jti: uuid(),
    purpose: "password-reset",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(secret))

  const resetUrl = `${appUrl}/reset-password?token=${token}`

  if (hasPlaceholderSmtp) {
    console.error("[forgot-password] SMTP is not configured. Set SMTP_EMAIL and SMTP_PASSWORD.")

    if (!isProduction) {
      console.warn("[forgot-password] DEV fallback active - returning reset URL preview", {
        to: normalizedEmail,
        resetUrl,
      })
      return NextResponse.json({ ok: true, resetUrl, delivery: "DEV_PREVIEW" })
    }

    return NextResponse.json(
      {
        error: "EMAIL_NOT_CONFIGURED",
        message: "Password reset email service is not configured. Please contact support.",
      },
      { status: 500 }
    )
  }

  const transport = smtpHost
    ? nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpEmail,
          pass: smtpPassword,
        },
      })
    : nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: smtpEmail,
          pass: smtpPassword,
        },
      })

  try {
    const info = await transport.sendMail({
      from: smtpFrom,
      to: normalizedEmail,
      subject: "Reset your password",
      html: `
        <p>You requested a password reset.</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>This link expires in 15 minutes.</p>
      `,
    })

    console.log("[forgot-password] reset email accepted", {
      to: normalizedEmail,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    })
  } catch (error) {
    console.error("[forgot-password] sendMail failed", error)

    if (!isProduction) {
      console.warn("[forgot-password] DEV fallback on sendMail failure - returning reset URL preview", {
        to: normalizedEmail,
        resetUrl,
      })
      return NextResponse.json({ ok: true, resetUrl, delivery: "DEV_PREVIEW" })
    }

    return NextResponse.json(
      {
        error: "EMAIL_SEND_FAILED",
        message: "Unable to send reset email right now. Please try again.",
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
