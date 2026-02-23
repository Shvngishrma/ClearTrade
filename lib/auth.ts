import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"
import { cookies } from "next/headers"
import { SignJWT } from "jose"
import { prisma } from "./db"

const AUTH_COOKIE_NAME = "auth_token"

function getJwtSecret() {
  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "development-secret"
  return new TextEncoder().encode(secret)
}

export async function createToken(userId: string) {
  return await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret())
}

export function setAuthCookie(token: string) {
  cookies().set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
}

export function clearAuthCookie() {
  cookies().delete(AUTH_COOKIE_NAME)
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  console.log("SESSION:", session)
  
  if (!session?.user?.id) {
    console.log("USER:", null)
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  console.log("USER:", user)
  return user
}
