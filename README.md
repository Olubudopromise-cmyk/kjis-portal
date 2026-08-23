# King James International School — Portal (v2, real backend)

Student, teacher and admin portal for King James International School — attendance,
fees, results and an AI study assistant, built with Next.js and Supabase.

A Next.js + Supabase rebuild of the prototype. Hashed passwords, real server-side
sessions, and Paystack payments confirmed by webhook (never trusted from the browser).

## License

Proprietary — all rights reserved. This code is built specifically for King James
International School and is not licensed for reuse, distribution, or modification
by others.

This ships with real, working features across all three roles:

- **Login** — student by full name, staff by username, hashed passwords, signed sessions.
- **Admin** — register students (auto-generates a suggested password from the name),
  manage classes, manage subjects per category (Science/Art/Commercial), post notices,
  build each class's weekly timetable.
- **Teacher** — mark daily attendance for their class, enter CA/exam scores per subject,
  view their class's fee status.
- **Student** — attendance history with a running %, a printable termly report card,
  their subject list, their weekly timetable, an AI study assistant (calls Claude
  server-side, so the API key never reaches the browser), school notices, and paying
  their fee balance through a real Paystack checkout.

**Not yet in this version:** face verification (see the note in
`app/api/auth/login/route.js` for how to wire it in properly), and a teacher-facing
"register a student into my class" screen (the API route already supports it —
`POST /api/students` as a teacher — it just doesn't have a UI yet, unlike admin's
version on `/admin`).

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → New project. Pick a region close to
   Nigeria (e.g. an EU or nearest available region) for lower latency.
2. Once it's created: **SQL Editor → New query**, paste the contents of
   `supabase/schema.sql`, and run it. This creates all the tables.
3. **Project Settings → API** — copy the **Project URL** and the **service_role**
   key (not the `anon` key — the service role key is what your server uses).

## 2. Set up Paystack

1. Create an account at [paystack.com](https://paystack.com).
2. **Settings → API Keys & Webhooks** — copy your **Secret Key** (use the test key
   while developing).
3. Come back and set the webhook URL here once you've deployed (step 6).

## 3. Configure environment variables

```
cp .env.example .env.local
```

Fill in `.env.local` with your real Supabase URL/key, a random `SESSION_SECRET`
(generate one with `openssl rand -base64 48`), your Paystack secret key, and your
Anthropic API key (for the AI tutor — get one at console.anthropic.com/settings/keys).
**Never commit `.env.local`** — it's already in `.gitignore`.

## 4. Install and run locally

```
npm install
npm run create-admin -- admin "choose-a-strong-password" "Head Administrator"
npm run dev
```

Visit `http://localhost:3000`, choose "Head Admin", and sign in with the username/
password you just created. From there you can register a student and see them appear
in the table.

## 5. Push to GitHub

```
git init
git add .
git commit -m "King James Portal — Next.js + Supabase rebuild"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## 6. Deploy

1. Go to [vercel.com](https://vercel.com) → New Project → import your GitHub repo.
2. In the Vercel project's **Settings → Environment Variables**, add the same four
   variables from `.env.local`.
3. Deploy. Vercel gives you a live HTTPS URL immediately — you can add a custom
   domain (e.g. kingjamesschool.ng) under **Settings → Domains** afterwards.
4. Back in Paystack: **Settings → API Keys & Webhooks**, set the webhook URL to
   `https://<your-domain>/api/payments/webhook`.

## What's next (in priority order)

- **A teacher-facing "register a student" screen** — the `/api/students` route
  already accepts requests from teachers, scoped to their own class. It just needs
  the same kind of form the admin page already has.
- **Face verification, done properly** — see the note in
  `app/api/auth/login/route.js`. Either drop it for v1, or integrate a vendor
  (AWS Rekognition / Azure Face API) and gate session creation on a second,
  server-verified step. Get parental consent before storing any student's photo —
  Nigeria's NDPR treats this as sensitive data.
- **Payment status polling** — right now the student's balance updates as soon as
  Paystack's webhook fires, but the page itself doesn't auto-refresh after they're
  redirected back from checkout. A simple "check payment status" poll or a toast
  on return would smooth that out.
- **Report card terms/sessions** — results currently aren't split by term; add a
  `term` column to `results` when you're ready to keep history across terms.

## Security notes baked in already

- Passwords are bcrypt-hashed, never stored or logged in plain text.
- All Supabase tables have Row Level Security **enabled with no policies** — only
  your server (using the service-role key) can touch them. The browser never talks
  to Supabase directly.
- Payments only mark "paid" from the Paystack **webhook**, verified with an HMAC
  signature — a student can't fake a successful payment from dev tools.
- Sessions are signed, httpOnly cookies (not readable by JavaScript), expiring
  after 12 hours.
