import { ReactNode } from 'react';

type BaseProps = {
  children: ReactNode;
  className?: string;
};

function cx(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

export function AppShell({ children, className }: BaseProps) {
  return <main className={cx('app-shell', className)}>{children}</main>;
}

export function PageHeader({ children, className }: BaseProps) {
  return <header className={cx('page-header', className)}>{children}</header>;
}

export function SummaryCard({ children, className }: BaseProps) {
  return <section className={cx('summary-card', className)}>{children}</section>;
}

export function SectionCard({ children, className }: BaseProps) {
  return <section className={cx('section-card', className)}>{children}</section>;
}

export function CardHeader({ children, className }: BaseProps) {
  return <div className={cx('card-header', className)}>{children}</div>;
}

export function StatGrid({ children, className }: BaseProps) {
  return <div className={cx('stat-grid', className)}>{children}</div>;
}

export function StatItem({
  label,
  value,
  helper,
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
}) {
  return (
    <div className="stat-item">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {helper ? <span className="stat-helper">{helper}</span> : null}
    </div>
  );
}

export function StatusChip({ label, tone = 'neutral' }: { label: string; tone?: string }) {
  return <span className={cx('status-chip', `status-chip--${tone}`)}>{label}</span>;
}

export function InlineFeedback({
  message,
  tone = 'info',
}: {
  message: ReactNode;
  tone?: 'info' | 'success' | 'error' | 'warning';
}) {
  return <div className={cx('inline-feedback', `inline-feedback--${tone}`)}>{message}</div>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function LoadingBlock({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="loading-block" aria-live="polite">
      <span className="loading-dot" />
      <span>{label}</span>
    </div>
  );
}
