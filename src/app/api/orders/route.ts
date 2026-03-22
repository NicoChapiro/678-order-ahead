import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { customerAuthRepository } from '@/server/modules/customer-auth/repository';
import {
  CustomerAuthError,
  requireAuthenticatedCustomerSession,
} from '@/server/modules/customer-auth/service';
import { orderRepository } from '@/server/modules/orders/repository';
import {
  createOrder,
  MenuItemUnavailableError,
  OrderAheadUnavailableError,
  OrderInsufficientFundsError,
  OrderNotFoundError,
  OrderValidationError,
} from '@/server/modules/orders/service';

const createOrderSchema = z.object({
  storeCode: z.enum(['store_1', 'store_2', 'store_3']),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

export async function POST(request: NextRequest) {
  const body = createOrderSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  let authenticatedSession;

  try {
    authenticatedSession = await requireAuthenticatedCustomerSession(customerAuthRepository, request);
  } catch (error) {
    if (error instanceof CustomerAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ error: 'No pudimos revisar tu sesión.' }, { status: 500 });
  }

  try {
    const order = await createOrder(orderRepository, {
      ...body.data,
      customerIdentifier: authenticatedSession.customer.id,
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof OrderAheadUnavailableError || error instanceof MenuItemUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof OrderInsufficientFundsError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }
    if (error instanceof OrderNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error(
      'Unexpected error in create order route.',
      {
        storeCode: body.data.storeCode,
        customerIdentifier: authenticatedSession.customer.id,
        itemCount: body.data.items.length,
      },
      error,
    );
    return NextResponse.json(
      { error: 'No pudimos confirmar tu pedido. Intenta de nuevo.' },
      { status: 500 },
    );
  }
}
