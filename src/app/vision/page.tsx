import { redirect } from "next/navigation"

// Redirect /vision → /en-US/vision (middleware handles locale detection for direct visits)
export default function VisionRedirect() {
  redirect("/en-US/vision")
}
