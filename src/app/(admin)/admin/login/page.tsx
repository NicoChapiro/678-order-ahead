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

    const response = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? 'Could not sign in.');
      setIsSubmitting(false);
      return;
    }

    router.push('/admin');
    router.refresh();
  }

  return (
    <main className="auth-page-shell">
      <section className="auth-layout" aria-labelledby="staff-login-title">
        <div className="auth-intro surface-soft">
          <span className="summary-card__eyebrow">Staff access</span>
          <div className="stack">
            <h1 id="staff-login-title">Welcome back</h1>
            <p>
              Sign in to manage order-ahead availability, menus, wallets, and live store operations
              from a single staff workspace.
            </p>
          </div>
          <div className="auth-trust-list" aria-label="Staff portal highlights">
            <div className="stat-item">
              <span className="stat-label">Focused workspace</span>
              <strong className="stat-value">Operations dashboard</strong>
              <span className="stat-helper">
                Inventory, order status, and wallet tools in one place.
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Consistent access</span>
              <strong className="stat-value">Secure staff sign-in</strong>
              <span className="stat-helper">
                Use your assigned team email and password to continue.
              </span>
            </div>
          </div>
        </div>

        <section className="summary-card auth-card" aria-label="Staff login form">
          <div className="stack auth-card__header">
            <span className="kicker">Admin portal</span>
            <div className="stack">
              <h2>Staff login</h2>
              <p className="helper-text">
                Enter your credentials to continue to the operations dashboard.
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
                onChange={(event) => setEmail(event.target.value)}
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
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            {error ? <InlineFeedback message={error} tone="error" /> : null}

            <button
              className="button button--primary button--block"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
