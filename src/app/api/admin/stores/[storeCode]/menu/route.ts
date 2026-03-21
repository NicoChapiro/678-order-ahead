import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { menuRepository } from '@/server/modules/menu/repository';
import {
  attachMenuItemToStore,
  getAdminStoreMenu,
  MenuConflictError,
  MenuNotFoundError,
  MenuValidationError,
} from '@/server/modules/menu/service';
import { StaffAuthError, getRequiredStaffSession } from '@/server/modules/staff-auth/service';

const paramsSchema = z.object({
  storeCode: z.enum(['store_1', 'store_2', 'store_3']),
});

const attachSchema = z.object({
  menuItemId: z.string().uuid(),
  priceAmount: z.number().int().positive(),
  currencyCode: z.literal('CLP').default('CLP'),
  isVisible: z.boolean().optional(),
  isInStock: z.boolean().optional(),
  sortOrder: z.number().int().nullable().optional(),
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

  try {
    const menu = await getAdminStoreMenu(menuRepository, params.data.storeCode);
    return NextResponse.json({ menu });
  } catch (error) {
    if (error instanceof MenuNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}

export async function POST(
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

  const body = attachSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const item = await attachMenuItemToStore(menuRepository, {
      storeCode: params.data.storeCode,
      ...body.data,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof MenuValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof MenuConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof MenuNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
