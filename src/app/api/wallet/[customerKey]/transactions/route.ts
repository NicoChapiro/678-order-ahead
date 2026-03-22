import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { customerAuthRepository } from '@/server/modules/customer-auth/repository';
import {
  CustomerAuthError,
  requireAuthenticatedCustomerSession,
} from '@/server/modules/customer-auth/service';
import { walletRepository } from '@/server/modules/wallet/repository';
import { listWalletTransactions, WalletValidationError } from '@/server/modules/wallet/service';

const paramsSchema = z.object({
  customerKey: z.literal('me'),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ customerKey: string }> },
) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: 'No encontramos esa wallet.' }, { status: 404 });
  }

  try {
    const authenticatedSession = await requireAuthenticatedCustomerSession(customerAuthRepository, request);
    const walletData = await listWalletTransactions(walletRepository, authenticatedSession.customer.id);
    return NextResponse.json(walletData);
  } catch (error) {
    if (error instanceof CustomerAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof WalletValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Unexpected error in wallet transactions route.', error);
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
