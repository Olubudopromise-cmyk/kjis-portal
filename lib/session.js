import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from './auth';

// Shared helper so every API route/page reads the session the same way.
export async function getSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}
