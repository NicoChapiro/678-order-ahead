import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCustomerIdentifierFromRequest } from '@/server/modules/customer-identity/session';
import { orderRepository } from '@/server/modules/orders/repository';
import {
  cancelOrderByCustomer,
  CancellationWindowExpiredError,
  InvalidOrderStateTransitionError,
  OrderNotFoundError,
  OrderValidationError,
} from '@/server/modules/orders/service';

const bodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const customerIdentifier = getCustomerIdentifierFromRequest(request);
  if (!customerIdentifier) {
    return NextResponse.json({ error: 'No encontramos tu sesión de pedido.' }, { status: 401 });
  }

  try {
    const result = await cancelOrderByCustomer(orderRepository, {
      orderId,
      customerIdentifier,
      ...body.data,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CancellationWindowExpiredError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof InvalidOrderStateTransitionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof OrderNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
