import { NextResponse } from 'next/server';
import { RekognitionClient, CompareFacesCommand } from '@aws-sdk/client-rekognition';
import supabaseAdmin from '../../../../lib/db';
import { verifySessionToken, createSessionToken, SESSION_COOKIE } from '../../../../lib/auth';

const SIMILARITY_THRESHOLD = 85; // 0-100. Higher = stricter match.

// The one Rekognition failure that is genuinely the user's fault: it couldn't
// find a usable face in the image they submitted, usually bad lighting or a
// turned-away head. Everything else — missing credentials, a bad signature,
// access denied, throttling, a network fault — is OUR infrastructure and must
// never be reported as "look at your camera better".
const CAMERA_FAULT_ERRORS = new Set(['InvalidParameterException']);

// Reads config once and reports exactly what is missing, so a misconfigured
// deployment is obvious in the logs instead of looking like a camera problem.
function getRekognitionClient() {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  const missing = [
    !region && 'AWS_REGION',
    !accessKeyId && 'AWS_ACCESS_KEY_ID',
    !secretAccessKey && 'AWS_SECRET_ACCESS_KEY',
  ].filter(Boolean);

  if (missing.length) {
    const err = new Error(`Missing AWS Rekognition environment variables: ${missing.join(', ')}`);
    err.name = 'RekognitionNotConfigured';
    throw err;
  }

  return new RekognitionClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function POST(request) {
  const { faceToken, image } = await request.json();
  if (!faceToken || !image) {
    return NextResponse.json({ error: 'Missing face token or photo.' }, { status: 400 });
  }

  // This token only proves "the password check already passed" — it is
  // NOT a session, and can't be reused as one. Reject anything else,
  // including an expired token or a full session token passed by mistake.
  const pending = await verifySessionToken(faceToken);
  if (!pending || pending.purpose !== 'face-pending') {
    return NextResponse.json({ error: 'Your sign-in has expired. Please start again.' }, { status: 401 });
  }

  const { data: student } = await supabaseAdmin.from('users').select('*').eq('id', pending.id).single();
  if (!student?.face_photo_url) {
    return NextResponse.json({ error: 'No reference photo on file. Contact the administrator.' }, { status: 400 });
  }

  // Fail fast and loudly on missing config, before spending time on storage I/O.
  let rekognition;
  try {
    rekognition = getRekognitionClient();
  } catch (err) {
    console.error('[face-verify] AWS Rekognition is not configured', {
      studentId: student.id,
      error: err.message,
    });
    return NextResponse.json(
      { error: 'Face verification is not available right now. Please contact the school.' },
      { status: 503 }
    );
  }

  const { data: refFile, error: downloadError } = await supabaseAdmin.storage
    .from('student-faces')
    .download(student.face_photo_url);
  if (downloadError || !refFile) {
    // Almost always the 'student-faces' bucket not existing. Surface the real
    // cause in the server log; the caller only needs to know it isn't them.
    console.error('[face-verify] Could not download reference photo', {
      studentId: student.id,
      path: student.face_photo_url,
      error: downloadError?.message || 'no file returned',
      code: downloadError?.statusCode,
      hint: 'Does the private "student-faces" storage bucket exist?',
    });
    return NextResponse.json(
      { error: 'We could not check your photo right now. Please contact the school.' },
      { status: 503 }
    );
  }
  const referenceBuffer = Buffer.from(await refFile.arrayBuffer());

  const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
  const liveBuffer = Buffer.from(base64Data, 'base64');

  let matched = false;
  try {
    const result = await rekognition.send(
      new CompareFacesCommand({
        SourceImage: { Bytes: liveBuffer },
        TargetImage: { Bytes: referenceBuffer },
        SimilarityThreshold: SIMILARITY_THRESHOLD,
      })
    );
    matched = (result.FaceMatches || []).length > 0;
  } catch (err) {
    // Always log the real cause first — the stack/name is what makes an
    // infra problem diagnosable.
    console.error('[face-verify] CompareFaces failed', {
      studentId: student.id,
      errorName: err?.name,
      errorCode: err?.Code,
      httpStatus: err?.$metadata?.httpStatusCode,
      message: err?.message,
    });

    if (CAMERA_FAULT_ERRORS.has(err?.name)) {
      return NextResponse.json(
        { error: "Couldn't get a clear look at your face. Try again with better lighting, facing the camera directly." },
        { status: 422 }
      );
    }

    // Anything else is us, not them. Say so honestly instead of implying the
    // student needs to fix their camera.
    return NextResponse.json(
      { error: 'Face verification is temporarily unavailable. Please try again shortly, or contact the school.' },
      { status: 503 }
    );
  }

  if (!matched) {
    console.warn('[face-verify] No match above threshold', {
      studentId: student.id, threshold: SIMILARITY_THRESHOLD,
    });
    return NextResponse.json({ error: "That doesn't match our records for this account." }, { status: 401 });
  }

  const token = await createSessionToken({ id: student.id, role: 'student', name: student.full_name });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return res;
}
