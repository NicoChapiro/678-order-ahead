type ClientLayoutProps = Readonly<{ children: React.ReactNode }>;

export default function ClientLayout({ children }: ClientLayoutProps) {
  return <>{children}</>;
}
