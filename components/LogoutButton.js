'use client';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }
  return (
    <button className="btn btn-outline btn-sm" onClick={handleLogout}>
      Sign out
    </button>
  );
}
