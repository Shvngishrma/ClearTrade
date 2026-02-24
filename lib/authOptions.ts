import GoogleProvider from "next-auth/providers/google"
import AppleProvider from "next-auth/providers/apple"
import CredentialsProvider from "next-auth/providers/credentials"
import type { DefaultSession, NextAuthOptions } from "next-auth"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

const PREMIUM_EMAIL = "knownconstant@gmail.com"
let roleColumnExists: boolean | null = null

function isPremiumEligibleEmail(email: string): boolean {
  return normalizeEmail(email) === PREMIUM_EMAIL
}

function normalizeEmail(email: string): string {
  return String(email || "").trim().toLowerCase()
}

function canonicalizeEmail(email: string): string {
  const normalized = normalizeEmail(email)
  const [local, domain] = normalized.split("@")
  if (!local || !domain) return normalized

  if (domain === "gmail.com" || domain === "googlemail.com") {
    const localNoPlus = local.split("+")[0]
    const localNoDots = localNoPlus.replace(/\./g, "")
    return `${localNoDots}@gmail.com`
  }

  return normalized
}

async function ensurePremiumRole(userId: string) {
  if (roleColumnExists === null) {
    try {
      const columnResult = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'User'
            AND column_name = 'role'
        ) AS "exists"
      `
      roleColumnExists = Boolean(columnResult?.[0]?.exists)
    } catch {
      roleColumnExists = false
    }
  }

  if (!roleColumnExists) {
    return
  }

  await prisma.$executeRaw`
    UPDATE "User"
    SET "role" = 'PREMIUM'
    WHERE id = ${userId}
  `
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      isPro: boolean
    } & DefaultSession["user"]
  }
  interface User {
    isPro: boolean
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    ...(process.env.APPLE_CLIENT_ID
      ? [
          AppleProvider({
            clientId: process.env.APPLE_CLIENT_ID,
            clientSecret: process.env.APPLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const normalizedEmail = normalizeEmail(credentials.email)

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        })

        if (!user) return null

        const valid = await bcrypt.compare(credentials.password, user.password!)

        if (!valid) return null

        return user
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" || account?.provider === "apple") {
        const normalizedEmail = normalizeEmail(user.email || "")
        if (!normalizedEmail) {
          return false
        }

        const canonicalOAuthEmail = canonicalizeEmail(normalizedEmail)

        let existingUser = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true, isPro: true, email: true },
        })

        if (!existingUser) {
          const candidates = await prisma.user.findMany({
            where: {
              email: {
                contains: "@",
              },
            },
            select: { id: true, isPro: true, email: true },
          })

          existingUser =
            candidates.find((candidate) => canonicalizeEmail(candidate.email) === canonicalOAuthEmail) || null
        }

        const dbUser = existingUser
          ? await prisma.user.update({
              where: { id: existingUser.id },
              data: existingUser.email === normalizedEmail ? {} : { email: normalizedEmail },
              select: { id: true, isPro: true, email: true },
            })
          : await prisma.user.create({
              data: {
                email: normalizedEmail,
              },
              select: { id: true, isPro: true, email: true },
            })

        ;(user as any).id = dbUser.id
        ;(user as any).isPro = dbUser.isPro
        ;(user as any).email = dbUser.email
      }

      const normalizedSignInEmail = normalizeEmail(user.email || "")
      if (isPremiumEligibleEmail(normalizedSignInEmail)) {
        try {
          const updatedUser = (user as any).id
            ? await prisma.user.update({
                where: { id: (user as any).id as string },
                data: { isPro: true },
                select: { id: true, isPro: true, email: true },
              })
            : await prisma.user.update({
                where: { email: normalizedSignInEmail },
                data: { isPro: true },
                select: { id: true, isPro: true, email: true },
              })

          await ensurePremiumRole(updatedUser.id)

          ;(user as any).id = updatedUser.id
          ;(user as any).isPro = updatedUser.isPro
          ;(user as any).email = updatedUser.email
        } catch (error) {
          console.error("[auth] Premium role assignment failed", {
            email: normalizedSignInEmail,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id || token.sub
        token.email = user.email
        token.isPro = user.isPro
        token.picture = (user as any).image || token.picture
      }

      const tokenEmail = normalizeEmail(String(token.email || ""))
      if (isPremiumEligibleEmail(tokenEmail)) {
        try {
          const promotedUser = token.id
            ? await prisma.user.update({
                where: { id: token.id as string },
                data: { isPro: true },
                select: { id: true, isPro: true },
              })
            : await prisma.user.update({
                where: { email: tokenEmail },
                data: { isPro: true },
                select: { id: true, isPro: true },
              })

          await ensurePremiumRole(promotedUser.id)
          token.id = promotedUser.id
          token.isPro = promotedUser.isPro
        } catch (error) {
          console.error("[auth] Premium role assignment via jwt failed", {
            email: tokenEmail,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      if (!token.id && token.sub) {
        token.id = token.sub
      }

      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { isPro: true },
        })
        if (dbUser) {
          token.isPro = dbUser.isPro
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = ((token.id as string | undefined) || (token.sub as string | undefined) || "")
        session.user.isPro = Boolean(token.isPro)
        session.user.image = (token.picture as string | undefined) || session.user.image
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url
      return `${baseUrl}/dashboard`
    },
  },
}