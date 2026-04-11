import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { SessionProvider } from "@/components/session-provider"
import { PublicFooter } from "@/components/public-footer"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })

export const metadata: Metadata = {
  title: "Summon Translator",
  description: "AI-powered translation — fast, accurate, and affordable. Supports JSON, XLIFF, Markdown, PDF, and more.",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.png",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} font-sans antialiased bg-gray-50 text-gray-900`}>
        <SessionProvider>
          {children}
          <PublicFooter />
        </SessionProvider>
      </body>
    </html>
  )
}
