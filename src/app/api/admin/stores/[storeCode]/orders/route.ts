import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { orderRepository } from '@/server/modules/orders/repository';
import { listAdminOrders } from '@/server/modules/orders/service';
import { ORDER_STATUS_VALUES } from '@/server/modules/orders/types';
import { StaffAuthError, getRequiredStaffSession } from '@/server/modules/staff-auth/service';

const paramsSchema = z.object({
  storeCode: z.enum(['store_1', 'store_2', 'store_3']),
});

const searchSchema = z.object({
  status: z.enum(ORDER_STATUS_VALUES).optional(),
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

  const search = searchSchema.safeParse({
    status: request.nextUrl.searchParams.get('status') ?? undefined,
  });
  if (!search.success) {
    return NextResponse.json({ error: search.error.flatten() }, { status: 400 });
  }

  const orders = await listAdminOrders(orderRepository, params.data.storeCode, search.data.status);
  return NextResponse.json({
    storeCode: params.data.storeCode,
    appliedFilter: { status: search.data.status ?? null },
    orders,
  });
}
