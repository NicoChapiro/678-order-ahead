import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { customerAuthRepository } from '@/server/modules/customer-auth/repository';
import {
  CustomerAuthValidationError,
  resolveCustomerIdentifierReference,
} from '@/server/modules/customer-auth/service';
import { StaffAuthError, getRequiredStaffSession } from '@/server/modules/staff-auth/service';
import { walletRepository } from '@/server/modules/wallet/repository';
import { getWalletSummary, WalletValidationError } from '@/server/modules/wallet/service';

const paramsSchema = z.object({
  customerKey: z.string().trim().min(1).max(120),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ customerKey: string }> },
) {
  try {
    await getRequiredStaffSession(request);
  } catch (error) {
    if (error instanceof StaffAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: 'Invalid customer key.' }, { status: 400 });
  }

  try {
    const customerIdentifier = await resolveCustomerIdentifierReference(
      customerAuthRepository,
      params.data.customerKey,
    );
    const summary = await getWalletSummary(walletRepository, customerIdentifier);

    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof CustomerAuthValidationError || error instanceof WalletValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Unexpected error in admin wallet summary route.', error);
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
