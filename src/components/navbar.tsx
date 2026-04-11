"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"

export function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!session?.user) return null

  const { role } = session.user

  const navLinks = [
    { href: "/translation-studio", label: "Translation Studio", match: "/translation-studio" },
    { href: "/jobs", label: "My Jobs", match: "/jobs" },
    ...(role === "admin" ? [{ href: "/admin/users", label: "Users", match: "/admin/users" }] : []),
    ...(role === "admin" ? [{ href: "/admin/applications", label: "Applications", match: "/admin/applications" }] : []),
    { href: "/billing", label: "Billing", match: "/billing" },
    ...(role === "admin" ? [{ href: "/admin/settings", label: "Settings", match: "/admin/settings" }] : []),
  ]

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/translation-studio" className="flex items-center gap-2 shrink-0">
          <Image src="/logo.png" alt="Summon Translator" width={32} height={32} className="rounded-full" />
          <span className="font-semibold text-indigo-600 text-lg tracking-tight hidden sm:block">Summon Translator</span>
          <span className="font-semibold text-indigo-600 text-base tracking-tight sm:hidden">Summon</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-4">
          {navLinks.map(({ href, label, match }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "text-sm font-medium transition-colors",
                pathname.startsWith(match) ? "text-indigo-600" : "text-gray-600 hover:text-gray-900"
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {session.user.name}
            <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              {session.user.role}
            </span>
          </span>
          <Link
            href="/careers"
            className={cn(
              "text-sm transition-colors",
              pathname === "/careers" ? "text-indigo-600 font-medium" : "text-gray-500 hover:text-gray-800"
            )}
          >
            Careers
          </Link>
          <Link
            href="/account"
            className={cn(
              "text-sm transition-colors",
              pathname === "/account" ? "text-indigo-600 font-medium" : "text-gray-500 hover:text-gray-800"
            )}
          >
            Account
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 px-4 py-3 space-y-1 bg-white">
          {navLinks.map(({ href, label, match }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "block px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith(match)
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              {label}
            </Link>
          ))}
          <div className="border-t border-gray-100 mt-2 pt-2 space-y-1">
            <div className="px-3 py-1.5 text-xs text-gray-400">
              {session.user.name} · {session.user.role}
            </div>
            <Link
              href="/careers"
              onClick={() => setMenuOpen(false)}
              className={cn(
                "block px-3 py-2 rounded-md text-sm transition-colors",
                pathname === "/careers"
                  ? "bg-indigo-50 text-indigo-600 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              Careers
            </Link>
            <Link
              href="/account"
              onClick={() => setMenuOpen(false)}
              className={cn(
                "block px-3 py-2 rounded-md text-sm transition-colors",
                pathname === "/account"
                  ? "bg-indigo-50 text-indigo-600 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              Account
            </Link>
            <button
              onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/login" }) }}
              className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
