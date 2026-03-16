import { NextResponse } from 'next/server';
import { z } from 'zod';
import { storeAvailabilityRepository } from '@/server/modules/stores/repository';
import {
  getCustomerOrderAheadAvailability,
  StoreNotFoundError,
} from '@/server/modules/stores/service';

const paramsSchema = z.object({
  storeCode: z.enum(['store_1', 'store_2', 'store_3']),
});

export async function GET(_: Request, context: { params: Promise<{ storeCode: string }> }) {
  const params = paramsSchema.safeParse(await context.params);

  if (!params.success) {
    return NextResponse.json({ error: 'Invalid store code.' }, { status: 400 });
  }

  try {
    const availability = await getCustomerOrderAheadAvailability(
      storeAvailabilityRepository,
      params.data.storeCode,
    );

    return NextResponse.json({ availability });
  } catch (error) {
    if (error instanceof StoreNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error('Unexpected error in customer order-ahead availability route.', error);

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
