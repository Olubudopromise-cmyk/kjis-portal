import { NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from './lib/auth';

function roleForPath(pathname) {
  if (pathname.startsWith('/student')) return 'student';
  if (pathname.startsWith('/teacher')) return 'teacher';
  if (pathname.startsWith('/admin')) return 'admin';
  return null;
}

// Public, un-advertised staff login pages. They live *inside* the protected
// prefixes above but must always be reachable — they're the pages that CREATE
// a session, so gating them would cause a redirect loop.
function publicStaffLoginPath(pathname) {
  if (pathname === '/teacher/login') return true;
  if (pathname === '/admin/login') return true;
  return false;
}

// Where to send someone who hit a protected page without the right session.
// Students share /login; staff go to their own role-scoped login page.
function loginPathForRole(role) {
  if (role === 'teacher') return '/teacher/login';
  if (role === 'admin') return '/admin/login';
  return '/login';
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  if (publicStaffLoginPath(pathname)) return NextResponse.next();

  const requiredRole = roleForPath(pathname);
  if (!requiredRole) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session || session.role !== requiredRole) {
    return NextResponse.redirect(new URL(loginPathForRole(requiredRole), request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/student/:path*', '/teacher/:path*', '/admin/:path*'],
};
