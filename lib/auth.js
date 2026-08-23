import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-secret-change-me');
export const SESSION_COOKIE = 'kjis_session';

// A signed, httpOnly cookie carrying {id, role, name}. jose works in the Edge
// runtime, so this is safe to use from middleware.js as well as API routes.
export async function createSessionToken(payload) {
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
  return new SignJWT({ ...payload, purpose: 'face-pending' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);
}

export async function verifySessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}
