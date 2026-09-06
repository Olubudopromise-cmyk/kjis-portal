-- Records whether a parent/guardian consented to storing the student's photo
-- for face verification (NDPR). Nullable on purpose: pre-migration rows stay
-- null (unknown), new registrations set true/false explicitly. The photo
-- storage path in /api/students only ever runs when consent is true.
alter table users add column if not exists face_consent boolean default false;

alter table users enable row level security;
