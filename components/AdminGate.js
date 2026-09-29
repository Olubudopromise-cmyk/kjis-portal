'use client';

import { useSelectedLayoutSegment } from 'next/navigation';

/**
 * Session gate for the whole /admin segment tree.
 *
 * /admin/login lives inside app/admin/layout.js, so a session check written in
 * that layout applies to the sign-in page too: with a present-but-invalid
 * cookie (expired, tampered, or another role) the login form was replaced by
 * the "Your session has expired" screen, whose "Back to sign in" link points
 * straight back at the same gated page — admin login became impossible until
 * the cookie was cleared by hand.
 *
 * The gate must therefore never fire on the login segment itself: whatever
 * cookie state exists, /admin/login renders its form unconditionally, and only
 * the protected pages get the expired-session screen.
 */
export default function AdminGate({ expired, children }) {
  const segment = useSelectedLayoutSegment();
  if (segment === 'login') return <>{children}</>;
  return <>{expired}</>;
}
