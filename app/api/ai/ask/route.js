import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../../lib/db';
import { getSession } from '../../../../lib/session';

// Server-side call to the Anthropic API — the key never reaches the browser.
// Only logged-in students can use this, and it's scoped to their own
// category/subjects so answers stay relevant.
export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'student') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { message, history } = await request.json();
  if (!message) return NextResponse.json({ error: 'A message is required.' }, { status: 400 });

  const { data: student } = await supabaseAdmin.from('users').select('*').eq('id', session.id).single();
  let subjectList = [];
  if (student?.category) {
    const { data: subs } = await supabaseAdmin.from('subjects').select('name').eq('category', student.category);
    subjectList = (subs || []).map((s) => s.name);
  }

  const systemPrompt = `You are the King James International School AI Study Assistant, helping a student named ${student.full_name}${student.category ? `, studying the ${student.category} category` : ''}${subjectList.length ? ` (subjects: ${subjectList.join(', ')})` : ''}.
Help with schoolwork: explain concepts clearly for their level, help them work through homework step by step without just handing over answers to what look like graded assignments, and offer to quiz them.
Keep answers focused and appropriately short for a chat window. Politely decline anything unrelated to schoolwork or inappropriate for a student.`;

  const messages = [...(history || []).slice(-10), { role: 'user', content: message }];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "The AI tutor couldn't respond just now. Please try again." }, { status: 502 });
  }
  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === 'text');
  return NextResponse.json({ reply: textBlock ? textBlock.text : "Sorry, I didn't catch that — could you rephrase?" });
}
