"use client"

import { AppShell } from "@/components/app-shell"
import { useState } from "react"

const FAQS: { section: string; items: { q: string; a: string }[] }[] = [
  {
    section: "Getting Started",
    items: [
      {
        q: "How do I start my first translation?",
        a: "Go to Translation Studio, click the upload area to select your file (or drag and drop it), choose your source language, select one or more target languages, pick an AI model, then click Translate. Your translated files will be ready to download within minutes.",
      },
      {
        q: "What file formats does Translation Studio support?",
        a: "Translation Studio accepts JSON, CSV, Markdown (.md), plain text (.txt), PDF, XLIFF (.xliff/.xlf), Apple Strings (.strings), Apple Stringsdict (.stringsdict), Apple XCStrings (.xcstrings), GNU PO (.po), Android XML, Flutter ARB (.arb), and Java Properties (.properties).",
      },
      {
        q: "How many target languages can I translate into at once?",
        a: "You can select as many target languages as you need in a single job. Each language is processed in parallel, so translating into 10 languages takes roughly the same time as translating into 1.",
      },
      {
        q: "Is there a free trial?",
        a: "Yes — sign up and enter the promo code 1TIME at checkout in Translation Studio. This gives you 10,000 words translated at no cost. No credit card is required to explore the app.",
      },
      {
        q: "Do I need a credit card to sign up?",
        a: "No. You can sign up and explore the app without adding a payment method. A card is only required when you want to run an AI translation job (after your free trial words are used).",
      },
    ],
  },
  {
    section: "Translation Jobs",
    items: [
      {
        q: "What AI models are available?",
        a: "Translation Studio supports multiple Claude models (claude-sonnet-4-6 and others) via the Anthropic API. Admins can configure which provider keys are available. The model choice affects translation quality and speed — Sonnet is recommended for most professional content.",
      },
      {
        q: "How long does a translation take?",
        a: "Most files complete in under 5 minutes. Larger PDFs or files with thousands of segments may take 10–15 minutes. Translation Studio shows real-time progress so you can see each language as it completes.",
      },
      {
        q: "What is the maximum file size I can upload?",
        a: "Files up to 10 MB are supported for most formats. PDFs are processed page-by-page so very large PDFs may take longer but are still supported.",
      },
      {
        q: "Can I translate a file into multiple formats at once?",
        a: "Each job translates one source file into one or more target languages. The output format matches the input format — for example, a JSON file produces translated JSON files, one per language.",
      },
      {
        q: "Where can I find my past translation jobs?",
        a: "All your jobs are listed in My Jobs (the list icon in the sidebar). You can expand each job to see per-language status and download individual files, or download a ZIP of all completed languages at once.",
      },
    ],
  },
  {
    section: "LQA Studio",
    items: [
      {
        q: "What is LQA Studio?",
        a: "LQA Studio (Language Quality Assessment) analyses a bilingual translation file and scores its quality across three dimensions: Accuracy, Language fluency, and Style. It detects errors, generates an Excel report, and can automatically revise the source file to fix identified issues.",
      },
      {
        q: "What file formats does LQA Studio accept?",
        a: "LQA Studio accepts bilingual XLIFF (.xlf / .xliff) and TMX (.tmx) files. These are the standard formats produced by Translation Studio and most CAT tools.",
      },
      {
        q: "What does the quality score mean?",
        a: "Scores range from 0–100. 80+ is High quality, 60–79 is Medium, and below 60 is Low. The score is weighted by word count per segment so longer segments have more impact on the overall result.",
      },
      {
        q: "Can LQA automatically fix the errors it finds?",
        a: "Yes. After the LQA report is ready, click Review & Select to choose which findings to revise, then Apply Fixes. The AI revises the translation based on the identified issues and regenerates the file for download.",
      },
    ],
  },
  {
    section: "Media Studio",
    items: [
      {
        q: "What is Media Studio?",
        a: "Media Studio translates subtitle files (.srt and .vtt formats) using AI. Upload your subtitle file, choose a target language, and download a translated subtitle file with all timestamps preserved exactly as in the original.",
      },
      {
        q: "What subtitle formats are supported?",
        a: "Media Studio supports SubRip (.srt) and WebVTT (.vtt) subtitle formats. The output preserves cue numbers, timestamps, and formatting from the original file.",
      },
    ],
  },
  {
    section: "Billing & Pricing",
    items: [
      {
        q: "How does pricing work?",
        a: "Summon Translator is pay-as-you-go — you are charged per translation job based on word count and the AI model used. There is no monthly subscription fee. You can see a cost estimate before submitting any job.",
      },
      {
        q: "When am I charged?",
        a: "Your card is charged when a translation job completes successfully. Incomplete or failed jobs are not charged. Your monthly bill accumulates all completed jobs and can be reviewed on the Billing page.",
      },
      {
        q: "How do I add or change my payment method?",
        a: "Go to Billing in the sidebar. If you have no card on file, click Add card — this takes you to a Stripe-hosted card setup page. If you already have a card, click Manage card to update or remove it.",
      },
      {
        q: "Can I download an invoice?",
        a: "Yes. On the Billing page, click Download invoice PDF to generate a PDF invoice for the current month showing a breakdown of all completed jobs and charges.",
      },
    ],
  },
  {
    section: "Account & API",
    items: [
      {
        q: "How do I create an API key?",
        a: "Go to Account in the sidebar and scroll to the API Keys section. Enter a name for the key (e.g. 'OpenClaw integration'), click Create key, and copy the key immediately — it is only shown once. Use the key as a Bearer token in the Authorization header when calling /api/v1/ endpoints.",
      },
      {
        q: "How do I reset my password?",
        a: "On the sign-in page, click Forgot password? and enter your email address. You'll receive a reset link valid for 1 hour. Note: password reset is not available for accounts that sign in exclusively with Google.",
      },
      {
        q: "How do I apply to become a reviewer?",
        a: "Visit /reviewer-signup while signed in. Fill in your bio, language pairs, rates, and upload your CV. An admin will review your application and notify you by email when it is approved or if more information is needed.",
      },
      {
        q: "I need more help — how do I contact support?",
        a: "Email us at support@summontranslator.com and we'll get back to you within one business day.",
      },
    ],
  },
]

// ── Tutorials ──────────────────────────────────────────────────────────────────

interface TutorialStep {
  title: string
  body: string
  tip?: string
}

interface Tutorial {
  id: string
  icon: string
  title: string
  description: string
  time: string
  tags: string[]
  steps: TutorialStep[]
  comingSoon?: boolean
}

const TUTORIALS: Tutorial[] = [
  {
    id: "webflow-pages",
    icon: "🌐",
    title: "Translate Webflow Pages",
    description: "Connect your Webflow site, translate page content into any language with AI, and push translations back in one click.",
    time: "5 min",
    tags: ["Webflow", "Integrations"],
    steps: [
      {
        title: "Get your Webflow API token",
        body: "In Webflow, open your site's Site Settings → Integrations → API Access and generate a new API token. Copy it — you'll paste it in the next step.",
        tip: "Use a site-level API token (a 64-character hex string). Workspace tokens will not work with the site content APIs.",
      },
      {
        title: "Connect Webflow in Integrations",
        body: "Go to Integrations in the sidebar and click the Webflow card to expand it. Paste your token into the API Token field and click Save credentials. A green banner confirms the save was successful.",
      },
      {
        title: "Test the connection",
        body: "Click Test connection. A green checkmark means the token is valid and your site is reachable. If you have multiple Webflow sites, a site picker appears — choose the site you want to translate.",
        tip: "If the test fails, double-check that the token is copied in full with no trailing spaces.",
      },
      {
        title: "Browse your pages",
        body: "After a successful connection test, your pages load automatically under the Available content section — no extra click needed. Each row shows the page name and its status (listed as 'Page'). If you have more than one Webflow site on your account, a Select site dropdown appears just above the list — pick the site you want before browsing. If your site has more than 6 pages, a search bar appears at the top of the list: type any part of the page name to filter instantly. The list is scrollable if your site has many pages. If the list is empty after connecting, click Refresh content to reload.",
        tip: "The page count shown next to 'Available content' is the total across your whole site. If you don't see a page you expect, check that it's published (draft-only pages may not appear), or try Refresh content to pick up recently added pages.",
      },
      {
        title: "Import a page for translation",
        body: "Click Import next to the page you want to translate. In the panel that opens, select the source language, pick one or more target languages, choose an AI model (Sonnet is recommended for web copy), then click Import & translate.",
        tip: "You can select multiple target languages in one import — all languages are translated in parallel, so adding more languages doesn't add extra time.",
      },
      {
        title: "Review in Translation Studio",
        body: "Translation Studio opens automatically with the page's text segments loaded. Each translatable text node from the Webflow DOM appears as a separate row. Review and edit any strings you'd like to refine, then wait for all languages to complete.",
      },
      {
        title: "Push translations back to Webflow",
        body: "Return to Integrations. Under Recent translations you'll see your job with a Push button for each completed language. Click Push [language] — translated text is written directly to the Webflow DOM API and immediately visible in your Webflow Designer.",
        tip: "Webflow's Localization feature must be enabled on your site to store locale-specific content. If translations don't appear in the Designer, confirm a secondary locale is configured under Site Settings → Localization.",
      },
    ],
  },
  {
    id: "github-i18n",
    icon: "🐙",
    title: "Translate GitHub i18n Files",
    description: "Import locale JSON, YAML, or .po files from a GitHub repository, translate them with AI, and commit the translated files back automatically.",
    time: "8 min",
    tags: ["GitHub", "Integrations", "i18n"],
    steps: [],
    comingSoon: true,
  },
  {
    id: "lqa-workflow",
    icon: "🔬",
    title: "Run a Full LQA Quality Review",
    description: "Upload a bilingual XLIFF file to LQA Studio, read the quality report, select problem segments, and auto-fix them with one click.",
    time: "10 min",
    tags: ["LQA Studio", "Quality"],
    steps: [],
    comingSoon: true,
  },
  {
    id: "pendo-guides",
    icon: "🎯",
    title: "Localise Pendo In-App Guides",
    description: "Pull guide content from Pendo Engage, translate step titles and body text, and push the localised guides back — without touching the Pendo editor.",
    time: "6 min",
    tags: ["Pendo", "Integrations"],
    steps: [
      {
        title: "Get your Pendo Integration Key",
        body: "In Pendo, go to Settings (cog icon) → Integrations → Integration Keys. Click New Key, give it a name (e.g. 'Summon Translator'), and copy the generated key. Keep it safe — you won't be able to see it again in full.",
        tip: "You need a Pendo account with the Engage module enabled. Integration Keys are different from API Keys — make sure you're in the Integrations section, not the API section.",
      },
      {
        title: "Connect Pendo in Integrations",
        body: "Go to Integrations in the sidebar and expand the Pendo card. Paste your integration key into the Integration Key field and click Save credentials. You should see a green 'Credentials saved' confirmation.",
      },
      {
        title: "Test the connection",
        body: "Click Test connection. A green checkmark means Pendo can be reached and the key is valid. Your guides list will load under Available content, showing each guide's name, its live status (Public, Draft, or Disabled), and the number of steps.",
        tip: "If the test fails, confirm the key was copied in full — Pendo integration keys are long and easy to truncate when copying.",
      },
      {
        title: "Duplicate the guide in Pendo first",
        body: "In Pendo, open the guide you want to translate, click the ⋯ menu, and choose Duplicate. Rename the copy to include the target language (e.g. 'Onboarding tour — FR'). This is the guide you'll push translations into — your original stays untouched.",
        tip: "Pushing a translation overwrites the guide's text content in place. Always work on a duplicate so you don't lose your source-language guide.",
      },
      {
        title: "Import the duplicated guide",
        body: "Back in Summon Translator, find the duplicated guide in the Available content list and click Import. In the panel that opens, choose your source language (the language the guide is currently written in), select one or more target languages, choose an AI model, then click Import & translate.",
      },
      {
        title: "Review in Translation Studio",
        body: "Translation Studio opens with each translatable segment from the guide loaded as a row. Guide content is broken into segments by step — you'll see entries like 'Step 1 title' and 'Step 1 body text'. Review and edit any translations before they're finalised.",
        tip: "HTML formatting tags are stripped for translation and re-applied on push. You only see plain text — this is intentional so AI can focus on the words, not the markup.",
      },
      {
        title: "Push translations back to Pendo",
        body: "Return to Integrations. Under Recent translations you'll see your job with a Push button for each completed language. Click Push [language] — the translated step titles and body text are written back into the duplicated guide via the Pendo API.",
      },
      {
        title: "Set the guide's audience in Pendo",
        body: "In Pendo, open the translated guide and configure its Audience rules to target users whose browser language matches your target locale (e.g. French users). Set the guide status to Public when you're ready to launch. Repeat from step 4 for each additional language.",
        tip: "Pendo's Audience Builder supports the 'Browser Language' attribute out of the box. Use it to show each language guide to the right users without code changes.",
      },
    ],
  },
  {
    id: "qualtrics-surveys",
    icon: "📊",
    title: "Translate Qualtrics Surveys",
    description: "Connect your Qualtrics account, pull survey questions and answer choices, translate them with AI, and push the translations back so respondents see your survey in their language.",
    time: "6 min",
    tags: ["Qualtrics", "Integrations"],
    steps: [
      {
        title: "Get your Qualtrics API token",
        body: "Sign in to Qualtrics, click your account name in the top-right corner, and choose Account Settings. In the left sidebar select Qualtrics IDs. Your API Token is displayed at the top of the page — click the token to copy it.",
        tip: "If you don't see an API Token, your Qualtrics licence may not include API access. Contact your Qualtrics administrator or your account manager to enable it.",
      },
      {
        title: "Find your data center ID",
        body: "On the same Qualtrics IDs page, look for the Data Center field — it shows a short code such as fra1, iad1, ca1, or syd1. Copy just that prefix (everything before '.qualtrics.com'). You'll paste this into the Data center ID field in the next step.",
        tip: "You can also read the data center from your Qualtrics URL: if your login URL is fra1.qualtrics.com, then fra1 is your data center ID.",
      },
      {
        title: "Connect Qualtrics in Integrations",
        body: "Go to Integrations in the sidebar and expand the Qualtrics card. Paste your API Token into the API token field and your data center code (e.g. fra1) into the Data center ID field. Click Save credentials — a green banner confirms the save was successful.",
        tip: "The data center field accepts the bare prefix (fra1) or the full hostname (fra1.qualtrics.com) — both formats work.",
      },
      {
        title: "Test the connection",
        body: "Click Test connection. A green checkmark means Qualtrics is reachable and the credentials are valid. Your account name appears next to the checkmark so you can confirm the right account is connected. Your survey list loads automatically under Available content.",
        tip: "If the test fails with 'Invalid API token or data center', double-check that the data center matches the prefix in your Qualtrics login URL. Tokens from sandbox environments won't work against production data centers.",
      },
      {
        title: "Browse your surveys",
        body: "Under Available content you'll see all surveys in your Qualtrics account, each showing its name, active or inactive status, and the number of questions. If you have many surveys, use the search bar to filter by name. Only surveys you own or have edit access to can be imported.",
        tip: "Inactive (draft) surveys are shown alongside active ones. You can import and translate a draft survey before it goes live — a good way to prepare multilingual surveys in advance.",
      },
      {
        title: "Import a survey for translation",
        body: "Click Import next to the survey you want to translate. In the panel that opens, select the source language (the language the survey is currently written in), choose one or more target languages, select an AI model (Sonnet is recommended for survey copy), then click Import & translate. Every question text and answer choice becomes a separate translatable segment.",
        tip: "Matrix questions generate multiple segments — one for the question stem and one per row label. This ensures each part is translated in its proper context.",
      },
      {
        title: "Review in Translation Studio",
        body: "Translation Studio opens with each translatable segment loaded as a row. Segments are labelled by question ID so you can see which part of the survey each one belongs to. Review the AI translations, edit any segment you'd like to refine, and wait for all languages to reach 100%.",
        tip: "HTML markup in question text (bold, line breaks) is stripped for translation and does not need to be reproduced — the translated text is pushed as plain text into the Qualtrics translation layer.",
      },
      {
        title: "Push translations back to Qualtrics",
        body: "Return to Integrations. Under Recent translations you'll see your job with a Push button for each completed language. Click Push [language] — translated question texts and answer choices are written directly into Qualtrics using the Survey Translations API. The survey immediately supports that language without any manual copy-pasting.",
        tip: "To verify the push worked, open the survey in Qualtrics, go to Survey Options → Survey Translations, and select the target language from the dropdown. You should see all your translated strings there.",
      },
      {
        title: "Enable the language for respondents",
        body: "In Qualtrics, open the survey and go to Survey Options → Survey Translations. Enable the language you just pushed. Respondents who take the survey with a browser set to that language will automatically see the translated version. You can also add a language selector question at the start of the survey to let respondents choose manually.",
        tip: "Qualtrics serves translated surveys based on the respondent's browser language or a lang= query parameter in the survey link. No code changes are needed — enabling the language in Survey Translations is all that's required.",
      },
    ],
  },
  {
    id: "media-subtitles",
    icon: "🎬",
    title: "Translate Video Subtitles",
    description: "Upload an SRT or VTT subtitle file to Media Studio, pick a target language, and download a translated file with all timestamps preserved.",
    time: "3 min",
    tags: ["Media Studio"],
    steps: [],
    comingSoon: true,
  },
  {
    id: "lqa-auto-improve",
    icon: "✨",
    title: "Auto-Improve Translation Quality",
    description: "Use the Auto-improve to High button in LQA Studio to automatically loop through revise → re-analyse passes until your translation reaches High quality.",
    time: "5 min",
    tags: ["LQA Studio", "Quality"],
    steps: [],
    comingSoon: true,
  },
  {
    id: "zendesk-help-center",
    icon: "🎧",
    title: "Localise Zendesk Help Center Articles",
    description: "Import Help Center articles from Zendesk, translate them with AI, and push localised versions back as Zendesk article translations.",
    time: "7 min",
    tags: ["Zendesk", "Integrations"],
    steps: [],
    comingSoon: true,
  },
  {
    id: "gitlab-i18n",
    icon: "🦊",
    title: "Translate GitLab Project i18n Files",
    description: "Connect a GitLab project, import localisation files from any branch, translate them, and commit the results back in one action.",
    time: "8 min",
    tags: ["GitLab", "Integrations", "i18n"],
    steps: [],
    comingSoon: true,
  },
]

// ── Components ─────────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-medium text-gray-900">{q}</span>
        <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${open ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-400"}`}>
          <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {open && (
        <p className="pb-4 text-sm text-gray-500 leading-relaxed">{a}</p>
      )}
    </div>
  )
}

function TutorialCard({ tutorial }: { tutorial: Tutorial }) {
  const [open, setOpen] = useState(false)

  if (tutorial.comingSoon) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 flex items-start gap-3 opacity-60">
        <span className="text-2xl mt-0.5 shrink-0">{tutorial.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-700">{tutorial.title}</span>
            <span className="text-xs font-medium bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Coming soon</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{tutorial.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tutorial.tags.map(tag => (
              <span key={tag} className="text-xs bg-white border border-gray-200 text-gray-400 px-2 py-0.5 rounded-full">{tag}</span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-2xl mt-0.5 shrink-0">{tutorial.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{tutorial.title}</span>
            <span className="text-xs font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full">
              {tutorial.steps.length} steps · {tutorial.time}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{tutorial.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tutorial.tags.map(tag => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
            ))}
          </div>
        </div>
        <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors mt-1 ${open ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-400"}`}>
          <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {/* Steps */}
      {open && (
        <div className="border-t border-gray-100 px-5 py-5">
          <div className="relative">
            {/* Vertical connector line */}
            <div className="absolute left-[15px] top-6 bottom-6 w-px bg-indigo-100" aria-hidden />

            <ol className="space-y-6">
              {tutorial.steps.map((step, i) => (
                <li key={i} className="flex gap-4">
                  {/* Step number bubble */}
                  <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold z-10">
                    {i + 1}
                  </div>
                  <div className="flex-1 pt-1 pb-1">
                    <p className="text-sm font-semibold text-gray-900 mb-1">{step.title}</p>
                    <p className="text-sm text-gray-500 leading-relaxed">{step.body}</p>
                    {step.tip && (
                      <div className="mt-2.5 flex gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        <span className="text-amber-500 shrink-0 mt-0.5 text-xs">💡</span>
                        <p className="text-xs text-amber-800 leading-relaxed">{step.tip}</p>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const liveTutorials = TUTORIALS.filter(t => !t.comingSoon)
  const upcomingTutorials = TUTORIALS.filter(t => t.comingSoon)

  return (
    <AppShell>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Support & FAQ</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Common questions about using Summon Translator. Can&apos;t find your answer?{" "}
            <a href="mailto:support@summontranslator.com" className="text-indigo-600 hover:underline">
              Email us
            </a>
            .
          </p>
        </div>

        {/* FAQ sections */}
        <div className="space-y-6">
          {FAQS.map(({ section, items }) => (
            <div key={section} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{section}</p>
              </div>
              <div className="px-5">
                {items.map(item => (
                  <FaqItem key={item.q} {...item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Tutorials ── */}
        <div id="tutorials" className="mt-12">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-900">Step-by-step tutorials</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Follow these guides to get the most out of each feature. More tutorials are added regularly.
            </p>
          </div>

          {/* Live tutorials */}
          <div className="space-y-3">
            {liveTutorials.map(tutorial => (
              <TutorialCard key={tutorial.id} tutorial={tutorial} />
            ))}
          </div>

          {/* Upcoming tutorials */}
          {upcomingTutorials.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Coming soon</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {upcomingTutorials.map(tutorial => (
                  <TutorialCard key={tutorial.id} tutorial={tutorial} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Still need help */}
        <div className="mt-10 bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-5 flex items-start gap-4">
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-900">Still need help?</p>
            <p className="text-sm text-indigo-700 mt-0.5">
              Email us at{" "}
              <a href="mailto:support@summontranslator.com" className="font-medium underline underline-offset-2">
                support@summontranslator.com
              </a>{" "}
              — we respond within one business day.
            </p>
          </div>
        </div>
      </main>
    </AppShell>
  )
}
