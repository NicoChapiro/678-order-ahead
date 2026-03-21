import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StaffAuthError, getRequiredStaffSession } from '@/server/modules/staff-auth/service';
import { walletRepository } from '@/server/modules/wallet/repository';
import {
  createAdminAdjustment,
  WalletInsufficientFundsError,
  WalletPermissionError,
  WalletValidationError,
} from '@/server/modules/wallet/service';

const paramsSchema = z.object({
  customerKey: z.string().trim().min(1).max(120),
});

const adjustmentSchema = z
  .object({
    direction: z.enum(['credit', 'debit']),
    amount: z.number().int().positive(),
    note: z.string().trim().max(400),
    referenceId: z.string().trim().max(120).optional(),
    externalReference: z.string().trim().max(191).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.direction === 'debit' && !value.note.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['note'],
        message: 'A reason or note is required for debit adjustments.',
      });
    }
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

  const body = adjustmentSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const ledgerEntry = await createAdminAdjustment(walletRepository, {
      customerIdentifier: params.data.customerKey,
      direction: body.data.direction,
      amount: body.data.amount,
      note: body.data.note,
      referenceId: body.data.referenceId,
      externalReference: body.data.externalReference,
      actorUserId: actor.staffUserId,
      actorRole: actor.role,
    });

    return NextResponse.json({ ledgerEntry }, { status: 201 });
  } catch (error) {
    if (error instanceof WalletPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof WalletInsufficientFundsError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof WalletValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
