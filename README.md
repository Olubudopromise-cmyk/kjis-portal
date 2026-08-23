# King James International School — Portal (v2, real backend)

Student, teacher and admin portal for King James International School — attendance,
fees, results and an AI study assistant, built with Next.js and Supabase.

## License

Proprietary — all rights reserved. This code is built specifically for King James
International School and is not licensed for reuse, distribution, or modification
by others.

## What's actually working

- **Login** — student by full name, staff by username, hashed passwords, signed
  sessions, plus **real face verification** for students who have a reference photo
  on file — matched server-side against AWS Rekognition, never trusted from the
  browser. Students without a photo on file simply skip that step (see "Known gaps"
  below).
- **Admin** — register students (with optional face capture, auto-generates a
  suggested password), register teachers and assign them a class, manage subjects
  per category (Science/Art/Commercial), post notices, build each class's weekly
  timetable, and set the school's **current term** so results roll over cleanly
  between terms.
- **Teacher** — register students straight into their own class (with face capture),
  mark daily attendance, enter CA/exam scores per subject, view their class's fee
  status.
- **Student** — attendance history with a running %, a printable termly report card
  with a **term switcher** to look back at past terms, their subject list, their
  weekly timetable, an AI study assistant (calls Claude server-side, key never
  reaches the browser), school notices, and paying their fee balance through a real
  Paystack checkout.

## Known gaps

- No screen yet for admin to add a reference photo to a student who was already
  registered before face verification existed — see the note in
  `app/api/auth/login/route.js`.
- Report cards don't yet show a class position/rank, just the student's own scores.
- No payment-status polling after returning from Paystack checkout — the balance
  updates as soon as the webhook fires, but the page itself doesn't auto-refresh.

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → New project. Pick a region close to
   Nigeria (e.g. an EU or nearest available region) for lower latency.
2. **SQL Editor → New query** — paste the contents of `supabase/schema.sql` and run
   it. This creates every table for a fresh install (including timetable, settings,
   and multi-term results).
   - If you'd already run an earlier version of this schema, instead run the two
     files in `supabase/migrations/` in order (002, then 003) — they only add
     what's missing.
3. **Storage → New bucket** — create a bucket named exactly `student-faces`, set to
   **Private**. This is where reference face photos live; the app only ever reads
   it server-side with the service-role key, never publicly.
4. **Project Settings → API** — copy the **Project URL** and the **service_role**
   key (not the `anon` key — the service role key is what your server uses).

## 2. Set up Paystack

1. Create an account at [paystack.com](https://paystack.com).
2. **Settings → API Keys & Webhooks** — copy your **Secret Key** (use the test key
   while developing).
3. Come back and set the webhook URL here once you've deployed (step 6).

## 3. Set up face verification (AWS Rekognition)

Face verification only activates for a student once they have a reference photo on
file — you can skip this section entirely for launch and add it later.

1. In the [AWS Console](https://console.aws.amazon.com), create an IAM user with
   **only** the `rekognition:CompareFaces` permission (least privilege — this key
   should not be able to do anything else in your AWS account).
2. Generate an access key for that user — copy the Access Key ID and Secret Access
   Key.
3. Pick a region close to Nigeria that supports Rekognition (e.g. `eu-west-1`).

## 4. Set up the AI tutor

Create an API key at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).

## 5. Configure environment variables

```
cp .env.example .env.local
```

Fill in `.env.local` with everything from steps 1–4: your Supabase URL/key, a
random `SESSION_SECRET` (generate one with `openssl rand -base64 48`), your
Paystack secret key, your Anthropic key, and your AWS credentials. **Never commit
`.env.local`** — it's already in `.gitignore`.

## 6. Install and run locally

```
npm install
npm run create-admin -- admin "choose-a-strong-password" "Head Administrator"
npm run dev
```

Visit `http://localhost:3000`, choose "Head Admin", and sign in. From there, add a
class (if you didn't run the seed data), register a teacher, and register a
student.

## 7. Push to GitHub

```
git init
git add .
git commit -m "King James Portal — Next.js + Supabase rebuild"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## 8. Deploy

1. Go to [vercel.com](https://vercel.com) → New Project → import your GitHub repo.
2. In the Vercel project's **Settings → Environment Variables**, add every variable
   from `.env.local`.
3. Deploy. Vercel gives you a live HTTPS URL immediately — add a custom domain
   under **Settings → Domains** afterwards.
4. Back in Paystack: **Settings → API Keys & Webhooks**, set the webhook URL to
   `https://<your-domain>/api/payments/webhook`.

## Security notes baked in already

- Passwords are bcrypt-hashed, never stored or logged in plain text.
- Face verification is a genuine server-side match (AWS Rekognition), gated behind
  a short-lived token that only proves "the password was correct" — it cannot be
  reused as a real session, and only 5 minutes to complete the face check.
- Reference face photos live in a **private** Supabase Storage bucket, never a
  public URL.
- All Supabase tables have Row Level Security **enabled with no policies** — only
  your server (using the service-role key) can touch them.
- Payments only mark "paid" from the Paystack **webhook**, verified with an HMAC
  signature — a student can't fake a successful payment from dev tools.
- Sessions are signed, httpOnly cookies (not readable by JavaScript), expiring
  after 12 hours.

## A note on biometric data (Nigeria NDPR)

If you turn on face verification for real students, get explicit parental consent
before storing any student's photo — Nigeria's NDPR treats this as sensitive
personal data. A short consent form at enrolment covering what's collected (a
reference photo), why (login security), and how it's stored (private, server-side
only) is a reasonable starting point — this isn't legal advice, just a practical
heads-up before you switch this on for real students.
