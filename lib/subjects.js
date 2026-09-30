// Which subject list a student should see.
//
// Senior students (SS 1-3) stream, so their list is their stream:
// Science / Art / Commercial. Junior students (JSS 1-3) do not stream, so they
// share one combined list stored under the 'Junior' category.
//
// Junior-ness is derived from the student's CLASS, not from users.category —
// that column stays a senior-only stream, so an admin is never asked to pick a
// stream for a junior student, and a mislabelled category can't hide a JSS
// student's subjects.
//
// Pure functions only: imported by the client and by API routes alike.

export const STREAM_CATEGORIES = ['Science', 'Art', 'Commercial'];
export const JUNIOR_CATEGORY = 'Junior';
export const ALL_CATEGORIES = [...STREAM_CATEGORIES, JUNIOR_CATEGORY];

// Matches the class names the school actually uses: "JSS 1", "JSS1", "JSS 3".
export function isJuniorClassName(className) {
  return /^\s*JSS\s*\d*\s*$/i.test(String(className || ''));
}

export function isSeniorClassName(className) {
  return /^\s*S\.?S\.?S?\s*\d*\s*$/i.test(String(className || '')) || /^\s*SS\s*\d*\s*$/i.test(String(className || ''));
}

// The single resolution rule used by every call site.
//
//   JSS class            -> 'Junior'      (whatever the stream says, if any)
//   SS class + stream    -> that stream
//   SS class, no stream  -> null (admin hasn't set one yet; show nothing)
//   no class at all      -> fall back to the raw stream, or null
export function subjectCategoryFor({ className, category } = {}) {
  if (isJuniorClassName(className)) return JUNIOR_CATEGORY;
  const stream = STREAM_CATEGORIES.includes(category) ? category : null;
  if (stream) return stream;
  return STREAM_CATEGORIES.includes(category) ? category : null;
}

// Human label for the student's stream, for prompts and empty states.
export function describeCategory({ className, category } = {}) {
  const resolved = subjectCategoryFor({ className, category });
  if (resolved === JUNIOR_CATEGORY) return 'Junior (JSS)';
  return resolved || '';
}
