import { NextResponse } from 'next/server';
import { z } from 'zod';
import { menuRepository } from '@/server/modules/menu/repository';
import { getCustomerStoreMenu, MenuNotFoundError } from '@/server/modules/menu/service';

const paramsSchema = z.object({
  storeCode: z.enum(['store_1', 'store_2', 'store_3']),
});

export async function GET(_: Request, context: { params: Promise<{ storeCode: string }> }) {
  const params = paramsSchema.safeParse(await context.params);

  if (!params.success) {
    return NextResponse.json({ error: 'Invalid store code.' }, { status: 400 });
  }

  try {
    const menu = await getCustomerStoreMenu(menuRepository, params.data.storeCode);
    return NextResponse.json({ menu });
  } catch (error) {
    if (error instanceof MenuNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error('Unexpected error in customer store menu route.', error);
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
