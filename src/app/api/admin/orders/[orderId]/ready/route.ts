import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { orderRepository } from '@/server/modules/orders/repository';
import {
  InvalidOrderStateTransitionError,
  markOrderReadyForPickup,
  OrderNotFoundError,
  OrderValidationError,
} from '@/server/modules/orders/service';
import { StaffAuthError, getRequiredStaffSession } from '@/server/modules/staff-auth/service';

const bodySchema = z.object({});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  let session;
  try {
    session = await getRequiredStaffSession(request);
  } catch (error) {
    if (error instanceof StaffAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const { orderId } = await context.params;

  try {
    const result = await markOrderReadyForPickup(orderRepository, {
      orderId,
      actorUserId: session.staffUserId,
      actorRole: session.role,
    });
    return NextResponse.json(result);
  } catch (error) {
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
