import { cookies } from "next/headers"
import { randomUUID } from "crypto"

export function getSessionId() {
  const cookieStore = cookies()
  let sessionId = cookieStore.get("sessionId")?.value

  if (!sessionId) {
    sessionId = randomUUID()
    cookieStore.set("sessionId", sessionId)
  }

  return sessionId
}
