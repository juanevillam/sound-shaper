import { Redirect } from 'expo-router';

import { useAuthStore } from '@/store/auth';

export default function Index() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  return <Redirect href={isAuthenticated ? '/home' : '/welcome'} />;
}
