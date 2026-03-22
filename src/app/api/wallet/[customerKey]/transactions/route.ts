import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { customerAuthRepository } from '@/server/modules/customer-auth/repository';
import {
  CustomerAuthError,
  CustomerAuthValidationError,
  requireAuthenticatedCustomerSession,
  resolveCustomerIdentifierReference,
} from '@/server/modules/customer-auth/service';
import { walletRepository } from '@/server/modules/wallet/repository';
import { listWalletTransactions, WalletValidationError } from '@/server/modules/wallet/service';

const paramsSchema = z.object({
  customerKey: z.string().trim().min(1).max(120),
});

export async function GET(request: NextRequest, context: { params: Promise<{ customerKey: string }> }) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: 'Invalid customer key.' }, { status: 400 });
  }

  try {
    let customerIdentifier = params.data.customerKey;

    if (customerIdentifier === 'me') {
      const authenticatedSession = await requireAuthenticatedCustomerSession(customerAuthRepository, request);
      customerIdentifier = authenticatedSession.customer.id;
    } else {
      customerIdentifier = await resolveCustomerIdentifierReference(
        customerAuthRepository,
        customerIdentifier,
      );
    }

    const walletData = await listWalletTransactions(walletRepository, customerIdentifier);
    return NextResponse.json(walletData);
  } catch (error) {
    if (error instanceof CustomerAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CustomerAuthValidationError || error instanceof WalletValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Unexpected error in wallet transactions route.', error);
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
