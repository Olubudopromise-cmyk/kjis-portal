// Shared helpers for the NERDC scheme-of-work feature.
//
// The curriculum table stores class_level as "JSS1".."SSS3" while the classes
// table stores names like "JSS 1".."SS 3". The settings table stores the
// current term as "First Term 2025/2026" while curriculum stores plain
// "First Term". These helpers translate between the two.

export function classLevelForClassName(className) {
  if (!className) return null;
  const normalized = String(className).trim().toUpperCase();
  const m = /^(JSS|SS)\s*(\d)$/.exec(normalized);
  if (!m) return null;
  return (m[1] === 'JSS' ? 'JSS' : 'SSS') + m[2];
}

export function termNameForSession(sessionTerm) {
  if (!sessionTerm) return null;
  const m = /^(First|Second|Third)\s+Term/i.exec(String(sessionTerm).trim());
  return m ? `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} Term` : null;
}

// The curriculum's subject_key for the two core subjects, used to pin them
// to the front of "This Week's Focus".
export const CORE_SUBJECT_KEYS = ['ENGLISH STUDIES', 'MATHEMATICS'];
