#!/usr/bin/env node
// Pre-flight check for face verification. Run this after filling in the AWS
// values in .env.local — it tells you exactly what is missing instead of
// leaving you to infer it from a login failure.
//
//   node scripts/check-face-verification.js
//   node scripts/check-face-verification.js --self-test path/to/face.jpg
//
// --self-test compares one image against ITSELF. A single face in the photo
// should come back at ~100% similarity, which proves the credentials, the
// region, the IAM policy and the network path all work end to end.
//
// Expected AWS setup (see README "Face verification"):
//   * IAM user with an access key, and this policy — nothing more:
//       {
//         "Version": "2012-10-17",
//         "Statement": [{
//           "Effect": "Allow",
//           "Action": "rekognition:CompareFaces",
//           "Resource": "*"
//         }]
//       }
//     CompareFaces is the only Rekognition action this app calls. No
//     CreateCollection / IndexFaces / DetectFaces is needed.
//   * The SAME region for AWS_REGION as the IAM user's keys. Rekognition
//     endpoints are regional and keys are not global.
//   * No Face Liveness webhook or content moderation needed for this design.

const fs = require('fs');
const path = require('path');

// Load .env.local by hand — this runs under `node`, not Next.js.
function loadEnv() {
  const file = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\s+#.*$/, '');
    }
  }
}
loadEnv();

const BUCKET = 'student-faces';
let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { failures++; console.log(`  ✗ ${m}`); };
const warn = (m) => console.log(`  ! ${m}`);

async function main() {
  const selfTestIdx = process.argv.indexOf('--self-test');
  const selfTestPath = selfTestIdx > -1 ? process.argv[selfTestIdx + 1] : null;

  console.log('\n1. AWS credentials');
  const { AWS_REGION: region, AWS_ACCESS_KEY_ID: keyId, AWS_SECRET_ACCESS_KEY: secret } = process.env;
  if (region) ok(`AWS_REGION = ${region}`); else bad('AWS_REGION is not set');
  if (keyId) ok(`AWS_ACCESS_KEY_ID = ${keyId.slice(0, 4)}…${keyId.slice(-4)}`); else bad('AWS_ACCESS_KEY_ID is not set');
  if (secret) ok('AWS_SECRET_ACCESS_KEY is set'); else bad('AWS_SECRET_ACCESS_KEY is not set');

  console.log('\n2. Supabase storage bucket');
  try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
    const { createClient } = require('@supabase/supabase-js');
    const ws = require('ws');
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }, realtime: { transport: ws },
    });
    const { data: bucket, error } = await db.storage.getBucket(BUCKET);
    if (error) bad(`bucket "${BUCKET}" not found — ${error.message}\n      Create it in the Supabase dashboard (Storage → New bucket, Public OFF) or run the create script.`);
    else {
      ok(`bucket "${bucket.name}" exists`);
      if (bucket.public) bad('bucket is PUBLIC — reference photos must stay private'); else ok('bucket is private');
    }

    const { data: withPhotos } = await db
      .from('users').select('id, full_name, face_photo_url, face_consent')
      .eq('role', 'student').not('face_photo_url', 'is', null);
    const photos = withPhotos?.length || 0;
    if (photos) ok(`${photos} student(s) have a reference photo on file`);
    else warn('no students have a reference photo yet — face verification is skipped at login until one does');

    const { data: consented } = await db
      .from('users').select('id').eq('role', 'student').eq('face_consent', true);
    warn(`${consented?.length || 0} student(s) have face_consent recorded (stored for compliance; the login gate keys off face_photo_url)`);

    if (selfTestPath) {
      console.log('\n3. CompareFaces self-test');
      if (!fs.existsSync(selfTestPath)) bad(`image not found: ${selfTestPath}`);
      else if (!region || !keyId || !secret) bad('skipping — credentials missing');
      else {
        const { RekognitionClient, CompareFacesCommand } = require('@aws-sdk/client-rekognition');
        const bytes = fs.readFileSync(selfTestPath);
        const client = new RekognitionClient({ region, credentials: { accessKeyId: keyId, secretAccessKey: secret } });
        try {
          const res = await client.send(new CompareFacesCommand({
            SourceImage: { Bytes: bytes },
            TargetImage: { Bytes: bytes },
            SimilarityThreshold: 80,
          }));
          const sim = res.FaceMatches?.[0]?.Similarity;
          if (typeof sim === 'number') ok(`face detected and matched itself at ${sim.toFixed(2)}% similarity`);
          else bad('Rekognition ran but found no face in the image — try a clear, front-facing photo');
        } catch (e) {
          bad(`CompareFaces failed: ${e.name} — ${e.message}`);
          if (/InvalidParameterException/.test(e.name)) warn('  → that means credentials and permissions are FINE; the image just has no detectable face');
          if (/UnrecognizedClient|InvalidSignature|SignatureDoesNotMatch/.test(e.name)) warn('  → bad key id or secret, or the key is inactive/deleted');
          if (/AccessDenied/.test(e.name)) warn('  → key is valid but missing rekognition:CompareFaces on this IAM policy');
          if (/InvalidEndpoint|NetworkingError|ENOTFOUND/.test(e.name)) warn(`  → region "${region}" is wrong or unreachable from here`);
        }
      }
    } else {
      console.log('\n3. CompareFaces self-test — skipped (pass --self-test <face.jpg> to run it)');
    }
  } catch (e) {
    bad(`storage check threw: ${e.message}`);
  }

  console.log(`\n${failures ? `${failures} problem(s) found.` : 'No problems found.'}\n`);
  process.exit(failures ? 1 : 0);
}

main();
