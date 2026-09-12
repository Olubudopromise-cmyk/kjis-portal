// Small, dependency-free inline icons. Emoji glyphs are rendered from whatever
// font a device happens to fall back to, so the same character can look
// completely different in two places on the same screen (they also pick up the
// UA style of <button>, which doesn't inherit the page font). These render as a
// single crisp SVG stroke wherever they're used instead.
export function NoticesIcon({ size = 17 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path d="M6 6h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
      <path d="M12 11v4" />
      <path d="M10 13.5v.01" strokeWidth="2.5" />
      <path d="M14 13.5v.01" strokeWidth="2.5" />
      <path d="M8 7.5l-3 2.5" />
      <path d="M16 7.5l3 2.5" />
    </svg>
  );
}
