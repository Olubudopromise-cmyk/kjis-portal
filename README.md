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
  below). A student's password is their **Admission No.** (school policy), so
  registration requires one and **Reset password** defaults back to it. Staff can
  self-reset their password via email (Resend).
- **Admin** — register students (Admission No. is required and becomes the password;
  optional face capture), register teachers and assign them a class, manage subjects
  (**Junior (JSS)** gets one flat non-streamed list; **Senior (SS)** keeps the
  Science/Art/Commercial stream tabs), post notices, add **All Classes** whole-school
  timetable events, and reset student passwords directly.
- **Teacher** — register students straight into their own class (with face capture),
  mark daily attendance, enter CA/exam scores per subject (the subject list is
  resolved from the student's class, so JSS and SS students both work), view their
  class's fee status, **build their own class's weekly timetable** in a Mon–Fri grid
  (their own periods editable, whole-school events shown read-only), and reset
  student passwords directly.
- **Student** — attendance history with a running %, a printable termly report card
  with a **term switcher** to look back at past terms, their subject list, their
  weekly timetable (class periods **+ 🎓 All Classes** events), an AI study assistant
  (calls Claude server-side, key never reaches the browser), school notices, and
  paying their fee balance through a real Paystack checkout.

## Known gaps

- No screen yet for admin to add a reference photo to a student who was already
  registered before face verification existed — see the note in
  `app/api/auth/login/route.js`.
- Face verification has **no liveness check**. The camera widget grabs a single still
  and `CompareFaces` matches against it, so a printed photo of the right face would
  pass. Closing that gap needs AWS Face Liveness (a separate service and IAM action)
  or a client-side challenge — it is not a small change, so it is called out rather
  than hidden.
- The `face_consent` column is recorded but never read: there's no admin report of who
  consented and no self-service deletion flow, even though the privacy page promises
  guardians can request deletion of a reference photo.
- Timetable conflict detection compares `period_label` by **string equality**
  (`"8:00 - 8:40"`), because the table has no `start_time`/`end_time` columns. Two
  entries meaning the same slot but typed differently won't be flagged. Conflicts are a
  **warning** the admin can override, not a hard block.
- Report cards don't yet show a class position/rank, just the student's own scores.
- **The `subjects` table needs migration `012_subjects_junior.sql` before any Junior
  (JSS) subject can be added.** Until it is run, `subjects.category` still only
  accepts Science/Art/Commercial and the Junior list stays empty. The admin page and
  the API both say so explicitly rather than failing silently.
- No payment-status polling after returning from Paystack checkout — the balance
  updates as soon as the webhook fires, but the page itself doesn't auto-refresh.

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → New project. Pick a region close to
   Nigeria (e.g. an EU or nearest available region) for lower latency.
2. **SQL Editor → New query** — paste the contents of `supabase/schema.sql` and run
   it. This creates every table for a fresh install (including timetable, settings,
   and multi-term results).
   - If you'd already run an earlier version of this schema, instead run the
     migration files in `supabase/migrations/` in order (002, 003, 004) — they
     only add what's missing. Run 004 to add the password reset tables and the
     `email` column to `users`.
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
file — a student with no `face_photo_url` logs in on their name + admission number
alone and skips this step entirely.

Since the password is the Admission No. (low entropy, and visible in the admin
Students table), this is the intended second factor. Get it working.

### Exactly what you need from AWS

**1. An IAM user with an access key.** In the [AWS Console](https://console.aws.amazon.com)
→ IAM → Users → Create user. Attach **only** this inline policy — nothing more:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "rekognition:CompareFaces",
    "Resource": "*"
  }]
}
```

`rekognition:CompareFaces` is the **only** Rekognition action this app calls. You do
**not** need `CreateCollection`, `IndexFaces`, `DetectFaces`, or any face collection —
nothing here stores faces in a Rekognition collection. Do not add `AmazonRekognitionFullAccess`;
it is far broader than this app uses.

**2. An access key for that user** — IAM → your user → Security credentials →
Create access key. Copy the **Access Key ID** and **Secret Access Key** at the moment
they are shown; AWS will not show the secret again.

**3. A region that supports Rekognition**, and it must be the **same region your
access key was created in** — Rekognition endpoints are regional, keys are not global.
`eu-west-1` (Ireland) is the usual choice for Nigeria; `af-south-1` also works and is
geographically closest. Verify your chosen region offers Rekognition in the
[AWS Regional Services](https://aws.amazon.com/about-aws/global-infrastructure/regional-services/)
list before committing to it.

**4. Nothing else.** No Face Liveness webhook, no content moderation, no Rekognition
collection to create. The app sends two JPEGs to `CompareFaces` and reads back a
similarity score.

### The values to put in `.env.local`

```bash
AWS_REGION=eu-west-1                    # must match the key's region
AWS_ACCESS_KEY_ID=AKIA...               # from the IAM user
AWS_SECRET_ACCESS_KEY=...               # from the IAM user
```

### Verify it before deploying

```bash
npm run check-face
```

This reports which of the three variables are missing, confirms the `student-faces`
bucket exists and is private, and tells you how many students have a reference photo.

To prove the credentials, region, IAM policy and network path all work end to end,
run the self-test against a clear, front-facing photo of a face:

```bash
npm run check-face -- --self-test path/to/face.jpg
```

It compares that image against **itself**, which should return ~100% similarity. If it
fails, the script names the likely cause (bad key, missing permission, wrong region,
or simply no detectable face in the photo).

**Don't commit real keys.** `.env.local` is gitignored; on Vercel set the three
`AWS_*` values as encrypted environment variables.

## 4. Set up the AI tutor

Create an API key at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).

## 5. Set up email for password resets (Resend)

Staff (teachers and admin) can self-reset their password via an email link.
This uses [Resend](https://resend.com) for transactional email.

1. Create a free account at [resend.com](https://resend.com).
2. Verify a sending domain you own, **or** use Resend's built-in test domain
   (`onboarding@resend.dev`) for development — it works out of the box with no
   DNS setup.
3. Copy your **API key** from the Resend dashboard.
4. Run the migration to add the required tables:
   ```
   SQL Editor → paste supabase/migrations/004_password_reset.sql → Run
   ```
5. Add `RESEND_API_KEY` to `.env.local` (see step 6).

Student password resets don't use email — a teacher or admin resets it directly
from the dashboard.

## 6. Configure environment variables

```
cp .env.example .env.local
```

Fill in `.env.local` with everything from steps 1–4: your Supabase URL/key, a
random `SESSION_SECRET` (generate one with `openssl rand -base64 48`), your
Paystack secret key, your Anthropic key, and your AWS credentials. **Never commit
`.env.local`** — it's already in `.gitignore`.

## 7. Install and run locally

```
npm install
npm run create-admin -- admin "choose-a-strong-password" "Head Administrator"
npm run dev
```

Visit `http://localhost:3000`, choose "Head Admin", and sign in. From there, add a
class (if you didn't run the seed data), register a teacher, and register a
student.

## 8. Push to GitHub

```
git init
git add .
git commit -m "King James Portal — Next.js + Supabase rebuild"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## 9. Deploy

1. Go to [vercel.com](https://vercel.com) → New Project → import your GitHub repo.
2. In the Vercel project's **Settings → Environment Variables**, add every variable
   from `.env.local`.
3. Deploy. Vercel gives you a live HTTPS URL immediately — add a custom domain
   under **Settings → Domains** afterwards.
4. Back in Paystack: **Settings → API Keys & Webhooks**, set the webhook URL to
   `https://<your-domain>/api/payments/webhook`.

## Security notes baked in already

- Passwords are bcrypt-hashed, never stored or logged in plain text.
- A student's password is their Admission No. — convenient for parents, but note
  it is low-entropy and visible in the admin Students table, so it is only as
  private as that page. Admission numbers are enforced unique (case-insensitive)
  so two students can never share a password. Face verification at login is the
  intended second factor for students who have a reference photo on file.
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
