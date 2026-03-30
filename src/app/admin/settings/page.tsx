import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { AiSettingsForm } from "@/components/ai-settings-form"
import { getProviderKeyStatus } from "@/lib/api-key-resolver"
import { PROVIDER_INFO } from "@/lib/ai-providers/registry"

export const dynamic = "force-dynamic"

export default async function AdminSettingsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role !== "admin") redirect("/dashboard")

  const keyStatus = await getProviderKeyStatus()

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
        <p className="text-sm text-gray-500 mb-6">Manage API keys used by Translation Studio to run AI translations.</p>
        <AiSettingsForm providers={PROVIDER_INFO} keyStatus={keyStatus} />
      </main>
    </div>
  )
}
