import createMiddleware from "next-intl/middleware"
import { routing } from "./i18n/routing"

export default createMiddleware(routing)

export const config = {
  matcher: [
    // Root and non-prefixed public pages that should receive locale prefix
    "/",
    "/login",
    "/vision",
    // Already-prefixed locale routes
    "/(en-US|en-CA|en-GB|en-AU|en-IN|es-ES|es-419|pt-BR|fr-FR|fr-CA|de-DE|it-IT|nl-NL|sv-SE|ja-JP|zh-CN|zh-TW|ko-KR|th-TH)/:path*",
  ],
}
