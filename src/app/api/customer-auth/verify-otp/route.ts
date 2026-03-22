import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { customerAuthRepository } from '@/server/modules/customer-auth/repository';
import { setCustomerSessionCookie } from '@/server/modules/customer-auth/session';
import {
  CustomerAuthError,
  CustomerAuthExpiredOtpError,
  CustomerAuthInvalidOtpError,
  CustomerAuthValidationError,
  verifyCustomerOtp,
} from '@/server/modules/customer-auth/service';
import { walletRepository } from '@/server/modules/wallet/repository';
import { getWalletSummary } from '@/server/modules/wallet/service';

const bodySchema = z.object({
  phoneNumber: z.string().trim().min(1).max(32),
  code: z.string().trim().min(1).max(12),
});

export async function POST(request: NextRequest) {
  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: 'Revisa el teléfono y el código.' }, { status: 400 });
  }

  try {
    const result = await verifyCustomerOtp(customerAuthRepository, body.data);
    const walletSummary = await getWalletSummary(walletRepository, result.customer.id);
    const response = NextResponse.json({
      customer: result.customer,
      walletSummary,
      message: 'Tu sesión ya está lista.',
    });

    setCustomerSessionCookie(response, result.sessionToken);
    return response;
  } catch (error) {
    if (error instanceof CustomerAuthValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof CustomerAuthInvalidOtpError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CustomerAuthExpiredOtpError) {
      return NextResponse.json({ error: error.message }, { status: 410 });
    }

    if (error instanceof CustomerAuthError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.error('Unexpected error in customer OTP verification route.', error);
    return NextResponse.json(
      { error: 'No pudimos confirmar el código. Intenta de nuevo.' },
      { status: 500 },
    );
  }
}
