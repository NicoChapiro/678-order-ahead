import { NextRequest, NextResponse } from 'next/server';
import { customerAuthRepository } from '@/server/modules/customer-auth/repository';
import {
  CustomerAuthError,
  requireAuthenticatedCustomerSession,
} from '@/server/modules/customer-auth/service';
import { orderRepository } from '@/server/modules/orders/repository';
import { listCustomerOrders, OrderValidationError } from '@/server/modules/orders/service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ customerKey: string }> },
) {
  const { customerKey } = await context.params;

  let authenticatedSession;

  try {
    authenticatedSession = await requireAuthenticatedCustomerSession(customerAuthRepository, request);
  } catch (error) {
    if (error instanceof CustomerAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ error: 'No pudimos revisar tu sesión.' }, { status: 500 });
  }

  const customerIdentifier =
    customerKey === 'me' ? authenticatedSession.customer.id : customerKey.trim();

  if (customerIdentifier !== authenticatedSession.customer.id) {
    return NextResponse.json({ error: 'No encontramos esos pedidos.' }, { status: 404 });
  }

  try {
    const orders = await listCustomerOrders(orderRepository, customerIdentifier);
    return NextResponse.json({ orders: Array.isArray(orders) ? orders : [] });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Unexpected error in customer orders route.', error);
    return NextResponse.json(
      { error: 'No pudimos revisar el estado de tu pedido.' },
      { status: 500 },
    );
  }
}
