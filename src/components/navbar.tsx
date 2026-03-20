"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()

  if (!session?.user) return null

  const { role } = session.user

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/translation-studio" className="flex items-center gap-2">
          <Image src="/logo.png" alt="Jendee AI" width={32} height={32} className="rounded-full" />
          <span className="font-semibold text-indigo-600 text-lg tracking-tight">Jendee AI</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/translation-studio"
            className={cn(
              "text-sm font-medium transition-colors",
              pathname.startsWith("/translation-studio")
                ? "text-indigo-600"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            Translation Studio
          </Link>
          {role === "admin" && (
            <Link
              href="/admin/settings"
              className={cn(
                "text-sm font-medium transition-colors",
                pathname === "/admin/settings"
                  ? "text-indigo-600"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              Settings
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">
          {session.user.name}
          <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
            {session.user.role}
          </span>
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
