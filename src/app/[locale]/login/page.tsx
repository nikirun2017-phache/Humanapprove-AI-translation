"use client"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { CostEstimator } from "@/components/cost-estimator"

function LoginForm() {
  const t = useTranslations("login")
  const tNav = useTranslations("nav")
  const router = useRouter()
  const searchParams = useSearchParams()

  const verifiedParam = searchParams.get("verified") // "ok" | "expired" | "invalid"
  const expiredEmail = searchParams.get("email") ?? ""

  const [mode, setMode] = useState<"signin" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  )
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<"google" | null>(null)

  // After signup — show "check your email" screen
  const [awaitingVerification, setAwaitingVerification] = useState(false)
  const [signupEmail, setSignupEmail] = useState("")
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)

  // Unverified sign-in attempt
  const [showVerifyHint, setShowVerifyHint] = useState(false)
  const [hintEmail, setHintEmail] = useState("")

  async function handleSocialSignIn(provider: "google") {
    setSocialLoading(provider)
    await signIn(provider, { callbackUrl: "/translation-studio" })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setShowVerifyHint(false)

    if (mode === "signup") {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json() as { error?: string; requiresVerification?: boolean }
      if (!res.ok) {
        setError(data.error ?? t("registerFailed"))
        setLoading(false)
        return
      }
      // Show "check your email" screen
      setSignupEmail(email)
      setAwaitingVerification(true)
      setLoading(false)
      return
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      // Check if it's an unverified account
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, checkOnly: true }),
      })
      const data = await res.json() as { pending?: boolean }
      if (data.pending) {
        setHintEmail(email)
        setShowVerifyHint(true)
      } else {
        setError(t("error"))
      }
    } else {
      router.push("/translation-studio")
    }
  }

  async function handleResend(emailToResend: string) {
    setResendLoading(true)
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailToResend }),
    })
    setResendLoading(false)
    setResendSent(true)
  }

  function switchMode(next: "signin" | "signup") {
    setMode(next)
    setError("")
    setShowVerifyHint(false)
    setAwaitingVerification(false)
  }

  // ── Post-signup: awaiting email verification ────────────────────────────
  const verifyScreen = (
    <div className="text-center space-y-5 py-2">
      <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      </div>
      <div>
        <p className="text-base font-semibold text-gray-900">Check your inbox</p>
        <p className="text-sm text-gray-500 mt-1">
          We sent a verification link to <strong>{signupEmail}</strong>.
          Click it to activate your account.
        </p>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 text-left">
        <strong>Heads up:</strong> You won&apos;t be able to sign in until you verify your email.
        Check your spam folder if you don&apos;t see it.
      </div>
      {resendSent ? (
        <p className="text-sm text-green-600 font-medium">Verification email resent!</p>
      ) : (
        <button
          type="button"
          onClick={() => handleResend(signupEmail)}
          disabled={resendLoading}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
        >
          {resendLoading ? "Sending…" : "Didn't receive it? Resend email"}
        </button>
      )}
      <button
        type="button"
        onClick={() => { setAwaitingVerification(false); setMode("signin") }}
        className="block w-full text-center text-sm text-gray-400 hover:text-gray-600"
      >
        Back to sign in
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="border-b border-gray-100 bg-white px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-indigo-600 text-xl tracking-tight">{tNav("brand")}</span>
        <a href="/" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">← Back to home</a>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

        {/* Left — SPRINT banner + cost estimator */}
        <div className="space-y-5">
          <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-4">
            <span className="text-2xl shrink-0 mt-0.5">🎁</span>
            <div>
              <p className="text-sm font-semibold text-indigo-900 mb-0.5">Translate your first 1,000 words free</p>
              <p className="text-sm text-indigo-700">
                Sign up and use code{" "}
                <span className="font-mono font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md tracking-wider">
                  1TIME
                </span>{" "}
                at checkout. No credit card required to explore.
              </p>
            </div>
          </div>
          <CostEstimator />
          <p className="text-xs text-gray-400 text-center">
            Estimate updates live as you adjust sliders. No commitment required.
          </p>
        </div>

        {/* Right — login form */}
        <div className="lg:sticky lg:top-12">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              {awaitingVerification ? "Almost there!" : mode === "signin" ? "Sign in to your account" : "Create your account"}
            </h1>
            {!awaitingVerification && (
              <p className="text-sm text-gray-500 mt-1">
                {mode === "signin" ? t("subtitle") : t("signupSubtitle")}
              </p>
            )}
          </div>

          {/* Verified success banner */}
          {verifiedParam === "ok" && (
            <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-4 py-3">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Email verified! You can now sign in.
            </div>
          )}
          {verifiedParam === "expired" && (
            <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3 space-y-1">
              <p className="font-medium">Verification link expired.</p>
              {expiredEmail && (
                <button onClick={() => handleResend(expiredEmail)} disabled={resendLoading} className="underline text-amber-700 disabled:opacity-50">
                  {resendLoading ? "Sending…" : "Send a new link"}
                </button>
              )}
            </div>
          )}
          {verifiedParam === "invalid" && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              Invalid verification link. Please request a new one.
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            {awaitingVerification ? verifyScreen : (
              <>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                {showVerifyHint && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-3 py-3 space-y-2">
                    <p className="font-medium">Please verify your email first.</p>
                    <p>Check your inbox for the verification link we sent to <strong>{hintEmail}</strong>.</p>
                    {resendSent ? (
                      <p className="text-green-700 font-medium">New link sent!</p>
                    ) : (
                      <button onClick={() => handleResend(hintEmail)} disabled={resendLoading} className="underline font-medium disabled:opacity-50">
                        {resendLoading ? "Sending…" : "Resend verification email"}
                      </button>
                    )}
                  </div>
                )}

                {/* Mode toggle */}
                <div className="flex rounded-lg border border-gray-200 p-1 gap-1">
                  <button type="button" onClick={() => switchMode("signin")}
                    className={"flex-1 text-sm font-medium py-1.5 rounded-md transition-colors " + (mode === "signin" ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-700")}>
                    {t("signinTab")}
                  </button>
                  <button type="button" onClick={() => switchMode("signup")}
                    className={"flex-1 text-sm font-medium py-1.5 rounded-md transition-colors " + (mode === "signup" ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-700")}>
                    {t("signupTab")}
                  </button>
                </div>

                {/* Social login */}
                <div className="space-y-2">
                  <button type="button" onClick={() => handleSocialSignIn("google")} disabled={!!socialLoading || loading}
                    className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                    {socialLoading === "google"
                      ? <span className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                      : <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>}
                    {t("continueWithGoogle")}
                  </button>

                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">{t("orWithEmail")}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === "signup" && (
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">{t("nameLabel")}</label>
                      <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Jane Smith" />
                    </div>
                  )}

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">{t("emailLabel")}</label>
                    <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="you@example.com" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700">{t("passwordLabel")}</label>
                      {mode === "signin" && (
                        <a href="/forgot-password" className="text-xs text-indigo-600 hover:text-indigo-700">Forgot password?</a>
                      )}
                    </div>
                    <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="••••••••" />
                    {mode === "signup" && <p className="text-xs text-gray-400 mt-1">{t("passwordHint")}</p>}
                  </div>

                  <button type="submit" disabled={loading || !!socialLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors">
                    {loading
                      ? mode === "signup" ? t("creatingAccount") : t("submitting")
                      : mode === "signup" ? t("createAccount") : t("submit")}
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">{t("contact")}</p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
