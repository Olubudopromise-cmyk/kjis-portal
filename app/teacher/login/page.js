import StaffLoginForm from '../../../components/StaffLoginForm';

// Un-advertised staff entry point — reachable only by direct URL, never linked
// from the public UI. Security still rests on the session + role checks, not
// on this page being secret.
export const metadata = { title: 'Staff Sign In — King James International School', robots: { index: false, follow: false } };

export default function TeacherLoginPage() {
  return <StaffLoginForm role="teacher" label="Teacher" />;
}
