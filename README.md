This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

Critical — Fix Before Launch
1. Stripe webhook is not configured
Your payment system relies on polling instead of Stripe webhooks. When a user adds a card, Stripe fires a webhook to confirm it — but your webhook secret is a placeholder and the handler isn't verified. This means payments could silently fail and users could get free translations. Set up the webhook endpoint in the Stripe dashboard and add STRIPE_WEBHOOK_SECRET to Cloud Run immediately.

2. Pricing will shock users
The cost shown in Step 3 is often $50–$150+ for a modest document. A 1,000-word job at 5× Claude Sonnet markup comes out to ~$128. That's not a typo — the pricing formula multiplies API costs by 5x then adds the per-word fee on top. Before launch: either validate this is intentional or recalibrate. If it is intentional, the UI needs to explain the value (human review quality, guaranteed accuracy) or users will bounce immediately.

3. File storage breaks under any real load
Translated files are saved to /tmp on Cloud Run. Cloud Run spins up multiple instances and they don't share a filesystem. A user could translate a file, then when they click Download hit a different instance that has no file. You partially fixed this with the DB cache for PDFs, but all other format downloads still depend on the disk. Every translated file needs to be stored in the DB or Google Cloud Storage before this can go to real users.

4. No rate limiting on translation jobs
A single user can submit 50 jobs simultaneously. Each job calls Claude hundreds of times. There's no per-user concurrency limit. One aggressive user — or a bot — can burn your entire Claude API budget in minutes and you'd have no way to detect it until the bill arrives.

High Priority — Will Hurt Retention
5. Users can't re-download after closing the browser
Auto-download fires when translation completes. If the user closes the tab before it finishes, or misses the download, the My Jobs page shows a download button — but only if the files are still accessible (see #3 above). This is the single most likely support ticket you'll get on day one.

6. No onboarding — new users hit a wizard with no context
The first page after signup is the translation wizard. There's no "here's how this works" moment, no example file to try, no guidance on what formats are supported or what a job costs. A new user who doesn't know what XLIFF is will be confused immediately. Add one sentence of context at the top of each step, or a simple "try a sample file" button.

7. The promo code minimum fee is counterintuitive
A user applies 1TIME (100% off first 1,000 words) to a $3 job. They expect $0. They get charged $5 (the minimum fee). The promo and the minimum fee interact in a way that's almost impossible to explain. Either remove the minimum fee for promo-covered jobs, or show a clear warning: "Minimum job fee of $5 applies even with discount."

8. No confirmation email for completed jobs with download links
You send a job completion email, but users have to go back to the app to download. Include the direct download links in the completion email itself — this is table-stakes UX for a file-delivery product.

Medium Priority — Polish Before Public Announcement
9. The legacy review system is ghost code
/projects, /dashboard, /pricing, /file-pairer all redirect to Translation Studio. The Prisma schema has 4+ tables (Project, TranslationUnit, ReviewSession, Comment) that nothing writes to. This bloats the codebase and confuses any future developer. Remove it cleanly before you bring on engineers.

10. No way to contact support
There's no help link, support email, or contact form anywhere in the app. When something goes wrong (and it will), users have nowhere to go. Add a single "Need help? Email us" link in the footer.

11. The "human review" value proposition is invisible
The product is called "Humanapprove-AI-translation" and marketed as "AI translation with human review" — but there's no human review feature visible to users. The reviewer role exists in the DB but the review workflow was replaced by Translation Studio. Either remove this claim from the marketing or build a simple approval flow before launch. Selling "human review" and not delivering it is a trust issue.


Client ID
31067192249-i223iq6bgi9s3bbtndgbg6rsb4cdesr6.apps.googleusercontent.com


secret
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