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

const paramsSchema = z.object({
  storeCode: z.enum(['store_1', 'store_2', 'store_3']),
});

const roleSchema = z.enum(['owner', 'barista', 'customer', 'viewer']);

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

function parseActor(request: NextRequest) {
  const actorUserId = request.headers.get('x-actor-user-id') ?? '';
  const actorRole = roleSchema.safeParse(request.headers.get('x-actor-role') ?? 'viewer');

  if (!actorUserId.trim() || !actorRole.success) {
    return null;
  }

  return {
    actorUserId: actorUserId.trim(),
    actorRole: actorRole.data,
  };
}

export async function GET(request: NextRequest, context: { params: Promise<{ storeCode: string }> }) {
  const actor = parseActor(request);
  if (!actor) {
    return NextResponse.json({ error: 'Missing actor headers.' }, { status: 401 });
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
  const actor = parseActor(request);
  if (!actor) {
    return NextResponse.json({ error: 'Missing actor headers.' }, { status: 401 });
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
      actorUserId: actor.actorUserId,
      actorRole: actor.actorRole,
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
