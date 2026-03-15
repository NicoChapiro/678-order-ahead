import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { storeAvailabilityRepository } from '@/server/modules/stores/repository';
import {
  getAdminOrderAheadOverview,
  OrderAheadPermissionError,
  OrderAheadValidationError,
  StoreNotFoundError,
  updateOrderAheadAvailability,
} from '@/server/modules/stores/service';
import { StaffAuthError, getRequiredStaffSession } from '@/server/modules/staff-auth/service';

const paramsSchema = z.object({
  storeCode: z.enum(['store_1', 'store_2', 'store_3']),
});

const updateSchema = z
  .object({
    newIsEnabled: z.boolean(),
    reasonCode: z
      .enum(['manual_pause', 'equipment_issue', 'staffing_issue', 'inventory_issue', 'system_issue', 'other'])
      .optional(),
    comment: z.string().max(300).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.newIsEnabled && !value.reasonCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reasonCode'],
        message: 'Reason code is required when disabling.',
      });
    }
  });

export async function GET(request: NextRequest, context: { params: Promise<{ storeCode: string }> }) {
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
    const overview = await getAdminOrderAheadOverview(storeAvailabilityRepository, params.data.storeCode);
    return NextResponse.json(overview);
  } catch (error) {
    if (error instanceof StoreNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ storeCode: string }> }) {
  let actor;

  try {
    actor = await getRequiredStaffSession(request);
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

  const body = updateSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const availability = await updateOrderAheadAvailability(storeAvailabilityRepository, {
      storeCode: params.data.storeCode,
      newIsEnabled: body.data.newIsEnabled,
      reasonCode: body.data.reasonCode,
      comment: body.data.comment,
      actorUserId: actor.staffUserId,
      actorRole: actor.role,
    });

    return NextResponse.json({ availability });
  } catch (error) {
    if (error instanceof OrderAheadPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof OrderAheadValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof StoreNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
