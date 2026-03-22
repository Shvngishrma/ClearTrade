import { redirect } from "next/navigation"
export default function LegacyMembersRouteRedirect() {
  redirect("/admin/member")
}
