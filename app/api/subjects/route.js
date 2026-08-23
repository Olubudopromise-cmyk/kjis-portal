import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/db';
import { getSession } from '../../../lib/session';

const CATEGORIES = ['Science', 'Art', 'Commercial'];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const { data, error } = await supabaseAdmin.from('subjects').select('*').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byCategory = { Science: [], Art: [], Commercial: [] };
  for (const row of data) {
    if (byCategory[row.category]) byCategory[row.category].push(row);
  }
  return NextResponse.json({ subjects: byCategory });
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  const { category, name } = await request.json();
  if (!CATEGORIES.includes(category) || !name) {
    return NextResponse.json({ error: 'Valid category and subject name required.' }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin.from('subjects').insert({ category, name }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, subject: data });
}

export async function DELETE(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'Subject id required.' }, { status: 400 });
  const { error } = await supabaseAdmin.from('subjects').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
