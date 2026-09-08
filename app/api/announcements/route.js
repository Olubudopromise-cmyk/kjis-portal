import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/db';
import { getSession } from '../../../lib/session';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const now = new Date();
  now.setMilliseconds(0);
  const nowISO = now.toISOString();

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)
    .or(`expires_at.is.null,expires_at.gt.${nowISO}`);

  if (error) {
    console.error('[announcements.GET] Supabase error:', error?.message, error?.code);
    return NextResponse.json({ error: 'Could not load notices.' }, { status: 500 });
  }

  return NextResponse.json({ announcements: data || [] });
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { text, expiresAt } = await request.json();
  if (!text) return NextResponse.json({ error: 'Notice text required.' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .insert({ text, author: session.name, expires_at: expiresAt || null })
    .select()
    .single();

  if (error) {
    console.error('[announcements.POST] Supabase error:', error?.message, error?.code);
    return NextResponse.json({ error: 'Could not create notice.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, announcement: data });
}

export async function DELETE(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'Notice id required.' }, { status: 400 });

  const { error } = await supabaseAdmin.from('announcements').delete().eq('id', id);
  if (error) {
    console.error('[announcements.DELETE] Supabase error:', error?.message, error?.code);
    return NextResponse.json({ error: 'Could not delete notice.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { id, text, expiresAt } = await request.json();
  if (!id) return NextResponse.json({ error: 'Notice id required.' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .update({ text: text ?? undefined, expires_at: expiresAt ?? undefined })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[announcements.PATCH] Supabase error:', error?.message, error?.code);
    return NextResponse.json({ error: 'Could not update notice.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, announcement: data });
}
