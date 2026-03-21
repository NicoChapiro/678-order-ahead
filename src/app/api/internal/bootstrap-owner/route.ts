import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getDatabaseEnv, getInternalSecurityEnv } from '@/server/env';
import { bootstrapOwnerIfNeeded } from '@/server/modules/staff-auth/bootstrap';

function isAuthorized(request: NextRequest): boolean {
  const secret = request.headers.get('x-internal-secret');

  if (!secret) {
    return false;
  }

  try {
    const { INTERNAL_API_SECRET } = getInternalSecurityEnv();
    const providedSecret = Buffer.from(secret);
    const configuredSecret = Buffer.from(INTERNAL_API_SECRET);

    if (providedSecret.length !== configuredSecret.length) {
      return false;
    }

    return timingSafeEqual(providedSecret, configuredSecret);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    getDatabaseEnv();

    const result = await bootstrapOwnerIfNeeded();

    if (!result.created) {
      return NextResponse.json({ ok: true, created: false, reason: result.reason });
    }

    return NextResponse.json({ ok: true, created: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: 'Server configuration error.' }, { status: 500 });
    }

    return NextResponse.json({ ok: false, error: 'Unexpected error.' }, { status: 500 });
  }
}
