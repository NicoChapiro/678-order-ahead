import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StaffAuthError, getRequiredStaffSession } from '@/server/modules/staff-auth/service';
import { walletRepository } from '@/server/modules/wallet/repository';
import {
  createCashierTopup,
  WalletPermissionError,
  WalletValidationError,
} from '@/server/modules/wallet/service';

const paramsSchema = z.object({
  customerKey: z.string().trim().min(1).max(120),
});

const createCashTopupSchema = z.object({
  amount: z.number().int().positive(),
  note: z.string().trim().max(400).optional(),
  externalReference: z.string().trim().max(191).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ customerKey: string }> },
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
    return NextResponse.json({ error: 'Invalid customer key.' }, { status: 400 });
  }

  const body = createCashTopupSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const ledgerEntry = await createCashierTopup(walletRepository, {
      customerIdentifier: params.data.customerKey,
      amount: body.data.amount,
      note: body.data.note,
      externalReference: body.data.externalReference,
      actorUserId: actor.staffUserId,
      actorRole: actor.role,
    });

    return NextResponse.json({ ledgerEntry }, { status: 201 });
  } catch (error) {
    if (error instanceof WalletPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof WalletValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
