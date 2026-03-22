'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InlineFeedback } from '@/components/ui/dashboard';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? 'Could not sign in.');
        return;
      }

      router.push('/admin');
      router.refresh();
    } catch {
      setError('Could not sign in.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page-shell">
      <section className="summary-card auth-panel" aria-labelledby="staff-login-title">
        <div className="stack auth-panel__header">
          <span className="summary-card__eyebrow">Staff access</span>
          <div className="stack">
            <h1 id="staff-login-title">Staff login</h1>
            <p className="helper-text">
              Sign in to continue to the operations dashboard for order-ahead, menu, and wallet
              management.
            </p>
          </div>
        </div>

        <form className="form-grid auth-form" onSubmit={onSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="name@company.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error) {
                  setError(null);
                }
              }}
              aria-describedby="email-help"
              disabled={isSubmitting}
              required
            />
            <p className="field-help" id="email-help">
              Use the email associated with your staff account.
            </p>
          </div>

          <div className="field">
            <div className="title-row auth-form__label-row">
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <span className="muted">Case-sensitive</span>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) {
                  setError(null);
                }
              }}
              disabled={isSubmitting}
              required
            />
          </div>

          {error ? <InlineFeedback message={error} tone="error" /> : null}

          <button
            className="button button--primary button--block auth-form__submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="meta-text auth-form__note">
            Use the credentials assigned to your staff account.
          </p>
        </form>
      </section>
    </main>
  );
}
