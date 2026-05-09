"use client"

import { Sidebar } from "@/components/sidebar"

/**
 * AppShell — authenticated page layout.
 *
 * Desktop: fixed 224px sidebar on the left, content fills the rest.
 * Mobile:  fixed top bar (14px) + full-width content below it.
 *
 * Usage:
 *   <AppShell>
 *     <main className="max-w-4xl mx-auto px-4 py-6">…</main>
 *   </AppShell>
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      {/* Content — offset by sidebar width on desktop, top-bar height on mobile */}
      <div className="md:ml-56 pt-14 md:pt-0">
        {children}
      </div>
    </div>
  )
}
