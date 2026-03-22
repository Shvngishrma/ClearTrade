import { redirect } from "next/navigation"
export default function LegacyGuestsRouteRedirect() {
  redirect("/admin/guest")
}
