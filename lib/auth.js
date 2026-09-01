import { SignJWT, jwtVerify } from 'jose';

function getSessionSecret() {
  const value = process.env.SESSION_SECRET || 'dev-secret-change-me';
  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('Missing SESSION_SECRET environment variable. Set it in Vercel or your .env.local file before deployment.');
  }
  return value;
}

export const SESSION_COOKIE = 'kjis_session';

// A signed, httpOnly cookie carrying {id, role, name}. jose works in the Edge
// runtime, so this is safe to use from middleware.js as well as API routes.
export async function createSessionToken(payload) {
  const secret = new TextEncoder().encode(getSessionSecret());
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret);
}

// A separate, short-lived token that only means "password was correct" — NOT
// a real session. It carries purpose:'face-pending' so it can't be mistaken
// for (or reused as) a full login. Only /api/auth/face-verify accepts it, and
// only for 5 minutes.
export async function createFaceToken(payload) {
  const secret = new TextEncoder().encode(getSessionSecret());
  return new SignJWT({ ...payload, purpose: 'face-pending' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);
}

export async function verifySessionToken(token) {
  try {
    const secret = new TextEncoder().encode(getSessionSecret());
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}
