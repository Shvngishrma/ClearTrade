import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "./db"

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
