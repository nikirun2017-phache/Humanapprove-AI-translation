import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { SessionProvider } from "@/components/session-provider"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })

export const metadata: Metadata = {
  title: "Jendee AI",
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
          <footer className="text-center text-xs text-gray-400 py-4 mt-auto space-x-3">
            <span>
              Need help?{" "}
              <a href="mailto:support@summontranslator.com" className="hover:text-gray-600 underline">
                support@summontranslator.com
              </a>
            </span>
            <span>·</span>
            <a href="/privacy" className="hover:text-gray-600 underline">Privacy Policy</a>
            <span>·</span>
            <a href="/terms" className="hover:text-gray-600 underline">Terms of Service</a>
          </footer>
        </SessionProvider>
      </body>
    </html>
  )
}
