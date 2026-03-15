'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const response = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? 'Could not sign in.');
      return;
    }

    router.push('/admin');
    router.refresh();
  }

  return (
    <main>
      <h1>Staff login</h1>
      <form onSubmit={onSubmit}>
        <label htmlFor="email">Email</label>{' '}
        <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <br />
        <label htmlFor="password">Password</label>{' '}
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <br />
        <button type="submit">Login</button>
      </form>
      {error ? <p>Error: {error}</p> : null}
    </main>
  );
}
