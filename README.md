# King James International School — Portal (v2, real backend)

Student, teacher and admin portal for King James International School — attendance,
fees, results and an AI study assistant, built with Next.js and Supabase.

A Next.js + Supabase rebuild of the prototype. Hashed passwords, real server-side
sessions, and Paystack payments confirmed by webhook (never trusted from the browser).

## License

Proprietary — all rights reserved. This code is built specifically for King James
International School and is not licensed for reuse, distribution, or modification
by others.

This ships with: login (student-by-name / staff-by-username), a starter dashboard
per role, and admin "register a student" with a real database. Attendance, results,
subjects, the AI tutor and face verification from the prototype are **not yet ported
in** — see "What's next" below.

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
(generate one with `openssl rand -base64 48`), and your Paystack secret key.
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

- **Attendance & results API routes** — same pattern as `/api/students`: a server
  route that checks `session.role`, then reads/writes Supabase.
- **Face verification, done properly** — see the note in
  `app/api/auth/login/route.js`. Either drop it for v1, or integrate a vendor
  (AWS Rekognition / Azure Face API) and gate session creation on a second,
  server-verified step. Get parental consent before storing any student's photo —
  Nigeria's NDPR treats this as sensitive data.
- **AI tutor route** — a `/api/ai/ask` route that calls the Anthropic API
  server-side (so your API key never reaches the browser), scoped to the
  logged-in student's subjects.
- **Timetable** — a new `timetable` table (class_id, day, period, subject) plus
  a student/teacher view.
- **Report cards** — port the grading logic from the prototype into a
  `/api/results` route and a printable report page.

## Security notes baked in already

- Passwords are bcrypt-hashed, never stored or logged in plain text.
- All Supabase tables have Row Level Security **enabled with no policies** — only
  your server (using the service-role key) can touch them. The browser never talks
  to Supabase directly.
- Payments only mark "paid" from the Paystack **webhook**, verified with an HMAC
  signature — a student can't fake a successful payment from dev tools.
- Sessions are signed, httpOnly cookies (not readable by JavaScript), expiring
  after 12 hours.
