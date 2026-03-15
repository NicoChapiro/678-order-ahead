import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerEnv } from '@/server/env';
import { StaffLoginError, loginStaffUser } from '@/server/modules/staff-auth/login';
import { getStaffSessionCookieName } from '@/server/modules/staff-auth/service';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = loginSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const { user, session } = await loginStaffUser(body.data.email, body.data.password);
    const response = NextResponse.json({ user });
    response.cookies.set(getStaffSessionCookieName(), session.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: getServerEnv().NODE_ENV === 'production',
      path: '/',
      expires: session.expiresAt,
    });

    return response;
  } catch (error) {
    if (error instanceof StaffLoginError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
