import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/db';
import { getSession } from '../../../lib/session';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const { data, error } = await supabaseAdmin.from('settings').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const map = {};
  (data || []).forEach((r) => { map[r.key] = r.value; });
  return NextResponse.json({ settings: map });
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  const { key, value } = await request.json();
  if (!key) return NextResponse.json({ error: 'key is required.' }, { status: 400 });

  const { error } = await supabaseAdmin.from('settings').upsert({ key, value });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
