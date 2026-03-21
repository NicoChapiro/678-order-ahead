import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StaffAuthError, getRequiredStaffSession } from '@/server/modules/staff-auth/service';
import { walletRepository } from '@/server/modules/wallet/repository';
import {
  rejectManualTopupRequest,
  WalletConflictError,
  WalletPermissionError,
  WalletTopupRequestNotFoundError,
} from '@/server/modules/wallet/service';

const paramsSchema = z.object({
  topupRequestId: z.string().uuid(),
});

const rejectionSchema = z.object({
  note: z.string().trim().max(400).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ topupRequestId: string }> },
) {
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
    return NextResponse.json({ error: 'Invalid top-up request id.' }, { status: 400 });
  }

  const body = rejectionSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const topupRequest = await rejectManualTopupRequest(walletRepository, {
      topupRequestId: params.data.topupRequestId,
      note: body.data.note,
      actorUserId: actor.staffUserId,
      actorRole: actor.role,
    });

    return NextResponse.json({ topupRequest });
  } catch (error) {
    if (error instanceof WalletPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof WalletTopupRequestNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof WalletConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
