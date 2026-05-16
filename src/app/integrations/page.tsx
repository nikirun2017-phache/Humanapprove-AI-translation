import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { IntegrationsManager } from "@/components/integrations-manager"
import { PROVIDER_INFO } from "@/lib/ai-providers/registry"

export const dynamic = "force-dynamic"

export default async function IntegrationsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role === "reviewer") redirect("/translation-studio")

  return (
    <AppShell>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Connect to your CMS or content platform. Import content into Translation Studio and push translations back — without leaving the app.
          </p>
        </div>

        <IntegrationsManager providers={PROVIDER_INFO} />
      </main>
    </AppShell>
  )
}
