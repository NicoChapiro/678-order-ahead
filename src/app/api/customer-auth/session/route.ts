import { NextRequest, NextResponse } from 'next/server';
import { customerAuthRepository } from '@/server/modules/customer-auth/repository';
import { clearCustomerSessionCookie } from '@/server/modules/customer-auth/session';
import { getAuthenticatedCustomerSession } from '@/server/modules/customer-auth/service';
import { walletRepository } from '@/server/modules/wallet/repository';
import { getWalletSummary } from '@/server/modules/wallet/service';

export async function GET(request: NextRequest) {
  try {
    const authenticatedSession = await getAuthenticatedCustomerSession(customerAuthRepository, request);

    if (!authenticatedSession) {
      const response = NextResponse.json({ authenticated: false, customer: null, walletSummary: null });
      clearCustomerSessionCookie(response);
      return response;
    }

    const walletSummary = await getWalletSummary(walletRepository, authenticatedSession.customer.id);

    return NextResponse.json({
      authenticated: true,
      customer: authenticatedSession.customer,
      walletSummary,
    });
  } catch (error) {
    console.error('Unexpected error in customer auth session route.', error);
    return NextResponse.json({ error: 'No pudimos revisar tu sesión.' }, { status: 500 });
  }
}
