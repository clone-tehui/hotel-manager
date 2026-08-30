import { redirect } from 'next/navigation';

// Root page redirects to the dashboard
export default function HomePage() {
  redirect('/dashboard');
}
