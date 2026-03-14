import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { SessionProvider } from "@/components/session-provider"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })

export const metadata: Metadata = {
  title: "XLIFF Review",
  description: "Collaborative XLIFF translation review platform",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} font-sans antialiased bg-gray-50 text-gray-900`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
