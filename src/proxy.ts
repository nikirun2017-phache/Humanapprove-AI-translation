import createMiddleware from "next-intl/middleware"
import { routing } from "./i18n/routing"

export default createMiddleware(routing)

export const config = {
  matcher: [
    // Match all public marketing routes (root, /vision)
    "/",
    "/(en-US|en-CA|en-GB|en-AU|en-IN|es-ES|es-419|pt-BR|fr-FR|fr-CA|de-DE|it-IT|nl-NL|sv-SE|ja-JP|zh-CN|zh-TW|ko-KR|th-TH)/:path*",
  ],
}
