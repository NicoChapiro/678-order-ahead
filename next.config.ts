import withPWA from 'next-pwa';
import type { NextConfig } from 'next';

const disablePwa =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_DISABLE_PWA === 'true';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
};

export default withPWA({
  dest: 'public',
  disable: disablePwa,
  register: true,
  skipWaiting: true,
})(nextConfig);
