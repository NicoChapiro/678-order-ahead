import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { menuRepository } from '@/server/modules/menu/repository';
import {
  MenuNotFoundError,
  MenuValidationError,
  updateStoreMenuItem,
} from '@/server/modules/menu/service';
import { StaffAuthError, getRequiredStaffSession } from '@/server/modules/staff-auth/service';

const paramsSchema = z.object({
  storeCode: z.enum(['store_1', 'store_2', 'store_3']),
  menuItemId: z.string().uuid(),
});

const updateSchema = z.object({
  priceAmount: z.number().int().positive(),
  currencyCode: z.literal('CLP').default('CLP'),
  isVisible: z.boolean(),
  isInStock: z.boolean(),
  sortOrder: z.number().int().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ storeCode: string; menuItemId: string }> },
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
    return NextResponse.json({ error: 'Invalid route parameters.' }, { status: 400 });
  }

  const body = updateSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const item = await updateStoreMenuItem(menuRepository, {
      storeCode: params.data.storeCode,
      menuItemId: params.data.menuItemId,
      ...body.data,
    });

    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof MenuValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof MenuNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
