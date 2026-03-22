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
