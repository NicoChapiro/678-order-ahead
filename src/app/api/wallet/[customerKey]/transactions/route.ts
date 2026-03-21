import { NextResponse } from 'next/server';
import { z } from 'zod';
import { walletRepository } from '@/server/modules/wallet/repository';
import { listWalletTransactions, WalletValidationError } from '@/server/modules/wallet/service';

const paramsSchema = z.object({
  customerKey: z.string().trim().min(1).max(120),
});

export async function GET(_: Request, context: { params: Promise<{ customerKey: string }> }) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: 'Invalid customer key.' }, { status: 400 });
  }

  try {
    const walletData = await listWalletTransactions(walletRepository, params.data.customerKey);
    return NextResponse.json(walletData);
  } catch (error) {
    if (error instanceof WalletValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Unexpected error in wallet transactions route.', error);
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
