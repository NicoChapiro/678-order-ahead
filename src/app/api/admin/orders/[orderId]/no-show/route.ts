import { NextRequest, NextResponse } from 'next/server';
import { orderRepository } from '@/server/modules/orders/repository';
import {
  InvalidOrderStateTransitionError,
  markOrderNoShow,
  OrderNotFoundError,
} from '@/server/modules/orders/service';
import { StaffAuthError, getRequiredStaffSession } from '@/server/modules/staff-auth/service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    await getRequiredStaffSession(request);
  } catch (error) {
    if (error instanceof StaffAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }

  const { orderId } = await context.params;

  try {
    const result = await markOrderNoShow(orderRepository, { orderId });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InvalidOrderStateTransitionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof OrderNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
