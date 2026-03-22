import { NextRequest, NextResponse } from 'next/server';
import { customerAuthRepository } from '@/server/modules/customer-auth/repository';
import {
  clearCustomerSessionCookie,
} from '@/server/modules/customer-auth/session';
import { signOutCustomerSession } from '@/server/modules/customer-auth/service';

export async function POST(request: NextRequest) {
  try {
    await signOutCustomerSession(customerAuthRepository, request);
    const response = NextResponse.json({ ok: true });
    clearCustomerSessionCookie(response);
    return response;
  } catch (error) {
    console.error('Unexpected error in customer auth logout route.', error);
    return NextResponse.json({ error: 'No pudimos cerrar tu sesión.' }, { status: 500 });
  }
}
