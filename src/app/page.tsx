import { redirect } from "next/navigation"

// The middleware handles locale detection and redirects.
// This fallback redirect ensures /  → /en-US if middleware is bypassed.
export default function RootPage() {
  redirect("/en-US")
}
