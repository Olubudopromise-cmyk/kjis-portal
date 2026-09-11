import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '../../../../lib/auth';

export async function GET() {
  const res = new NextResponse(null, { status: 302, headers: { Location: '/login' } });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

export async function POST() {
  const res = new NextResponse(null, { status: 302, headers: { Location: '/login' } });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
