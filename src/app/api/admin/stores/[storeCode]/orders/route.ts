import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { orderRepository } from '@/server/modules/orders/repository';
import { listAdminOrders } from '@/server/modules/orders/service';
import { StaffAuthError, getRequiredStaffSession } from '@/server/modules/staff-auth/service';

const paramsSchema = z.object({
  storeCode: z.enum(['store_1', 'store_2', 'store_3']),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ storeCode: string }> },
) {
  try {
    await getRequiredStaffSession(request);
  } catch (error) {
    if (error instanceof StaffAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: 'Invalid store code.' }, { status: 400 });
  }

  const orders = await listAdminOrders(orderRepository, params.data.storeCode);
  return NextResponse.json({ orders });
}
