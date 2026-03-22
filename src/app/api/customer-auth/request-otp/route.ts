import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { customerAuthRateLimitRepository } from '@/server/modules/customer-auth/rate-limit-repository';
import {
  assertOtpRequestAllowed,
  CustomerAuthRateLimitError,
  getRequestIpAddress,
} from '@/server/modules/customer-auth/rate-limit';
import { customerAuthRepository } from '@/server/modules/customer-auth/repository';
import { getSmsProvider } from '@/server/modules/customer-auth/sms';
import {
  CustomerAuthError,
  CustomerAuthValidationError,
  normalizePhoneNumber,
  requestCustomerOtp,
} from '@/server/modules/customer-auth/service';

const bodySchema = z.object({
  phoneNumber: z.string().trim().min(1).max(32),
});

export async function POST(request: NextRequest) {
  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: 'Ingresa un teléfono válido.' }, { status: 400 });
  }

  try {
    const normalizedPhoneNumber = normalizePhoneNumber(body.data.phoneNumber);

    await assertOtpRequestAllowed(customerAuthRateLimitRepository, {
      phoneNumber: normalizedPhoneNumber,
      ipAddress: getRequestIpAddress(request),
    });

    const result = await requestCustomerOtp(customerAuthRepository, getSmsProvider(), {
      phoneNumber: normalizedPhoneNumber,
    });

    return NextResponse.json({
      phoneNumber: result.phoneNumber,
      expiresAt: result.expiresAt,
      message: 'Te enviamos un código por SMS.',
    });
  } catch (error) {
    if (error instanceof CustomerAuthRateLimitError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: {
            'Retry-After': String(error.retryAfterSeconds),
          },
        },
      );
    }

    if (error instanceof CustomerAuthValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof CustomerAuthError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.error('Unexpected error in customer OTP request route.', error);
    return NextResponse.json(
      { error: 'No pudimos enviar el código. Intenta de nuevo.' },
      { status: 500 },
    );
  }
}
