import { NextResponse } from 'next/server';
import { RekognitionClient, CompareFacesCommand } from '@aws-sdk/client-rekognition';
import supabaseAdmin from '../../../../lib/db';
import { verifySessionToken, createSessionToken, SESSION_COOKIE } from '../../../../lib/auth';

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const SIMILARITY_THRESHOLD = 85; // 0-100. Higher = stricter match.

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

  const { data: refFile, error: downloadError } = await supabaseAdmin.storage
    .from('student-faces')
    .download(student.face_photo_url);
  if (downloadError || !refFile) {
    return NextResponse.json({ error: 'Could not load your reference photo. Contact the administrator.' }, { status: 500 });
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
    // Most common cause: Rekognition couldn't find a clear face in one of
    // the two images (bad lighting, face turned away, etc).
    return NextResponse.json({ error: "Couldn't get a clear look at your face. Try again with better lighting, facing the camera directly." }, { status: 422 });
  }

  if (!matched) {
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
