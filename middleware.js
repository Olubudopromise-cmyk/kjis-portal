import { NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from './lib/auth';

function roleForPath(pathname) {
  if (pathname.startsWith('/student')) return 'student';
  if (pathname.startsWith('/teacher')) return 'teacher';
  if (pathname.startsWith('/admin')) return 'admin';
  return null;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const requiredRole = roleForPath(pathname);
  if (!requiredRole) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session || session.role !== requiredRole) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/student/:path*', '/teacher/:path*', '/admin/:path*'],
};
