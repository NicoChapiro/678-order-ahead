import { NextRequest, NextResponse } from 'next/server';
import { orderRepository } from '@/server/modules/orders/repository';
import { listCustomerOrders, OrderValidationError } from '@/server/modules/orders/service';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ customerKey: string }> },
) {
  const { customerKey } = await context.params;

  try {
    const orders = await listCustomerOrders(orderRepository, customerKey);
    return NextResponse.json({ orders });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
