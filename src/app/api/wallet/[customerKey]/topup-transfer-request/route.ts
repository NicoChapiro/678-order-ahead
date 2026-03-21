import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { walletRepository } from '@/server/modules/wallet/repository';
import { createTransferTopupRequest, WalletValidationError } from '@/server/modules/wallet/service';

const paramsSchema = z.object({
  customerKey: z.string().trim().min(1).max(120),
});

const createTransferRequestSchema = z.object({
  amount: z.number().int().positive(),
  submittedReference: z.string().trim().max(191).optional(),
  note: z.string().trim().max(400).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ customerKey: string }> },
) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: 'Invalid customer key.' }, { status: 400 });
  }

  const body = createTransferRequestSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const topupRequest = await createTransferTopupRequest(walletRepository, {
      customerIdentifier: params.data.customerKey,
      amount: body.data.amount,
      submittedReference: body.data.submittedReference,
      note: body.data.note,
    });

    return NextResponse.json({ topupRequest }, { status: 201 });
  } catch (error) {
    if (error instanceof WalletValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
