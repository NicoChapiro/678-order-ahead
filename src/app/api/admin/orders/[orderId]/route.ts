import { NextRequest, NextResponse } from 'next/server';
import { orderRepository } from '@/server/modules/orders/repository';
import { getOrderDetail, OrderNotFoundError } from '@/server/modules/orders/service';
import { StaffAuthError, getRequiredStaffSession } from '@/server/modules/staff-auth/service';

export async function GET(
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
    const order = await getOrderDetail(orderRepository, orderId);
    return NextResponse.json({ order });
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
