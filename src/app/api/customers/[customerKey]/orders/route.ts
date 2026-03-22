import { NextRequest, NextResponse } from 'next/server';
import {
  resolveCustomerIdentifier,
  setCustomerIdentifierCookie,
} from '@/server/modules/customer-identity/session';
import { orderRepository } from '@/server/modules/orders/repository';
import { listCustomerOrders, OrderValidationError } from '@/server/modules/orders/service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ customerKey: string }> },
) {
  const { customerKey } = await context.params;
  const customerIdentity = resolveCustomerIdentifier(request);
  const customerIdentifier =
    customerKey === 'me' ? customerIdentity.customerIdentifier : customerKey;

  try {
    const orders = await listCustomerOrders(orderRepository, customerIdentifier);
    const response = NextResponse.json({ orders: Array.isArray(orders) ? orders : [] });

    if (customerKey === 'me' && customerIdentity.isNew) {
      setCustomerIdentifierCookie(response, customerIdentity.customerIdentifier);
    }

    return response;
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
