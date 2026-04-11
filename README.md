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




https://claude.ai/public/artifacts/dfcab2ad-ff14-4b9d-b7d1-51c6208eeb4c
https://claude.ai/public/artifacts/604268a3-2e71-41d2-bb68-2ab1a35d188d





2. Invoice PDF says "Jendee AI" + wrong support email
src/app/billing/page.tsx — downloadable invoices have old branding and support@jendeeai.com.

3. Promo code inconsistency
Login page shows 1TIME, wizard shows SPRINT is alwasy usable not one time only.

3.1 
please disable the stripe testing credit card, 4242 4242 4242 4242, and how to check if user actually pay for the service?



🟡 High (will hurt conversion)


6. GitHub PR write-back claims it pushes files back automatically
The help text says "translated files are pushed back to the PR branch automatically" — but this isn't implemented. please build it and change the copy to "download and commit manually."

7. $5 minimum fee is a surprise
Users submitting small files only discover the $5 minimum at Step 3. Show it earlier — e.g. in Step 2 or the cost estimator on the login page.

8. No pagination on My Jobs
Power users with many jobs will see a slow, endless list.

🟢 Polish (nice before launch)

10. No empty state for new users on My Jobs — currently shows a blank table
11. Glossary feature is hidden — collapsed by default, most users will miss it, please uncollapse by default
