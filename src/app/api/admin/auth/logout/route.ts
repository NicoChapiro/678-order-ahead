import { NextRequest, NextResponse } from 'next/server';
import { getServerEnv } from '@/server/env';
import { getStaffSessionCookieName, invalidateStaffSession } from '@/server/modules/staff-auth/service';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(getStaffSessionCookieName())?.value;

  if (token) {
    await invalidateStaffSession(token);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(getStaffSessionCookieName(), '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: getServerEnv().NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  });

  return response;
}
