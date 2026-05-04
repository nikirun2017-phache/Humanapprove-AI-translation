// Suppress Turbopack HMR "Performance.measure: end cannot be negative" DOMException.
// This file runs before any other client-side code (Next.js 15+ instrumentation-client).
// The bug is triggered when Turbopack's HMR client calls performance.measure() with
// server-provided timestamps that have a negative duration relative to performance.now().

if (typeof Performance !== "undefined") {
  const orig = Performance.prototype.measure
  Performance.prototype.measure = function (
    ...args: Parameters<typeof Performance.prototype.measure>
  ) {
    try {
      return orig.apply(this, args)
    } catch (e) {
      if (e instanceof DOMException && e.message.includes("negative")) return
      throw e
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener(
    "error",
    (e) => {
      if (e?.message?.includes("negative")) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    },
    true
  )
}
