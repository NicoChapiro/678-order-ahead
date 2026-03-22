import {
  CreateLedgerEntryInput,
  CustomerWallet,
  FIXED_WALLET_CURRENCY,
  WalletActorRole,
  WalletEntryType,
  WalletReferenceType,
  WalletRepository,
  WalletStaffRole,
  WalletSummary,
  WalletTopupMethod,
  WalletTopupRequest,
} from '@/server/modules/wallet/types';

export class WalletValidationError extends Error {}
export class WalletPermissionError extends Error {}
export class WalletNotFoundError extends Error {}
export class WalletTopupRequestNotFoundError extends Error {}
export class WalletInsufficientFundsError extends Error {}
export class WalletConflictError extends Error {}

const CASHIER_TOPUP_ROLES = new Set<WalletStaffRole>(['owner', 'barista']);
const ADMIN_ADJUSTMENT_ROLES = new Set<WalletStaffRole>(['owner']);
const MANUAL_TOPUP_REVIEW_ROLES = new Set<WalletStaffRole>(['owner', 'barista']);
const DEMO_CUSTOMER_WALLET_SEED_REFERENCE_ID = 'demo-customer-session-seed';
const DEMO_CUSTOMER_WALLET_SEED_NOTE = 'Demo seed balance for a new anonymous customer session.';

function normalizeCustomerIdentifier(customerIdentifier: string) {
  const normalized = customerIdentifier.trim();

  if (!normalized) {
    throw new WalletValidationError('Customer key is required.');
  }

  if (normalized.length > 120) {
    throw new WalletValidationError('Customer key must be 120 characters or fewer.');
  }

  return normalized;
}

function validateAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new WalletValidationError('Amount must be a positive integer in CLP.');
  }
}

function validateSupportedRole(role: string, supportedRoles: Set<WalletStaffRole>, message: string) {
  if (!supportedRoles.has(role as WalletStaffRole)) {
    throw new WalletPermissionError(message);
  }
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function getDemoCustomerWalletSeedAmount() {
  const rawValue = process.env.DEMO_CUSTOMER_WALLET_SEED_CLP?.trim();
  if (!rawValue) {
    return null;
  }

  const amount = Number(rawValue);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new WalletValidationError('DEMO_CUSTOMER_WALLET_SEED_CLP must be a positive integer.');
  }

  return amount;
}

function requireNote(note: string | null, message: string) {
  if (!note) {
    throw new WalletValidationError(message);
  }
}

function mapTopupMethodToEntryType(method: WalletTopupMethod): WalletEntryType {
  switch (method) {
    case 'card':
      return 'topup_card';
    case 'transfer':
      return 'topup_transfer';
    case 'cashier':
      return 'topup_cashier';
    case 'mercado_pago':
      return 'topup_mercado_pago';
    default:
      throw new WalletValidationError(`Unsupported top-up method '${method satisfies never}'.`);
  }
}

async function getWalletByCustomerIdentifier(
  repository: WalletRepository,
  customerIdentifier: string,
): Promise<CustomerWallet | null> {
  return repository.findWalletByCustomerIdentifier(normalizeCustomerIdentifier(customerIdentifier));
}

export async function getOrCreateWallet(
  repository: WalletRepository,
  customerIdentifier: string,
): Promise<CustomerWallet> {
  const normalizedCustomerIdentifier = normalizeCustomerIdentifier(customerIdentifier);
  const existingWallet = await repository.findWalletByCustomerIdentifier(normalizedCustomerIdentifier);

  if (existingWallet) {
    return existingWallet;
  }

  return repository.createWallet({
    customerIdentifier: normalizedCustomerIdentifier,
    currencyCode: FIXED_WALLET_CURRENCY,
  });
}

export async function getWalletSummary(
  repository: WalletRepository,
  customerIdentifier: string,
): Promise<WalletSummary> {
  const wallet = await getOrCreateWallet(repository, customerIdentifier);
  const currentBalance = await repository.getPostedBalance(wallet.id);

  return {
    wallet,
    currentBalance,
  };
}

export async function seedDemoWalletForNewCustomerSession(
  repository: WalletRepository,
  customerIdentifier: string,
) {
  const amount = getDemoCustomerWalletSeedAmount();
  if (amount === null) {
    return null;
  }

  const wallet = await getOrCreateWallet(repository, customerIdentifier);
  const existingEntries = await repository.listReferenceEntries(
    wallet.id,
    'admin_adjustment',
    DEMO_CUSTOMER_WALLET_SEED_REFERENCE_ID,
  );
  const existingSeedEntry = existingEntries.find((entry) => entry.status === 'posted');

  if (existingSeedEntry) {
    return existingSeedEntry;
  }

  return repository.createLedgerEntry(
    buildLedgerEntry({
      walletId: wallet.id,
      entryType: 'admin_adjustment_credit',
      amountSigned: amount,
      referenceType: 'admin_adjustment',
      referenceId: DEMO_CUSTOMER_WALLET_SEED_REFERENCE_ID,
      note: DEMO_CUSTOMER_WALLET_SEED_NOTE,
      createdByRole: 'system',
    }),
  );
}

export async function listWalletTransactions(
  repository: WalletRepository,
  customerIdentifier: string,
) {
  const wallet = await getOrCreateWallet(repository, customerIdentifier);
  const entries = await repository.listLedgerEntries(wallet.id);

  return {
    wallet,
    transactions: entries,
  };
}

function buildLedgerEntry(
  input: Omit<CreateLedgerEntryInput, 'currencyCode' | 'status'> & {
    currencyCode?: typeof FIXED_WALLET_CURRENCY;
    status?: 'posted';
  },
): CreateLedgerEntryInput {
  if (input.amountSigned === 0) {
    throw new WalletValidationError('Ledger entries cannot have a zero amount.');
  }

  return {
    ...input,
    currencyCode: input.currencyCode ?? FIXED_WALLET_CURRENCY,
    status: input.status ?? 'posted',
  };
}

export async function createCashierTopup(
  repository: WalletRepository,
  input: {
    customerIdentifier: string;
    amount: number;
    actorUserId: string;
    actorRole: WalletStaffRole;
    note?: string;
    externalReference?: string;
  },
) {
  validateSupportedRole(
    input.actorRole,
    CASHIER_TOPUP_ROLES,
    'Only owner or barista can create cashier top-ups.',
  );
  validateAmount(input.amount);

  const wallet = await getOrCreateWallet(repository, input.customerIdentifier);
  const note = normalizeOptionalText(input.note);

  return repository.createLedgerEntry(
    buildLedgerEntry({
      walletId: wallet.id,
      entryType: 'topup_cashier',
      amountSigned: input.amount,
      referenceType: 'cashier_topup',
      referenceId: `cashier:${Date.now()}`,
      externalReference: normalizeOptionalText(input.externalReference),
      note,
      createdByUserId: input.actorUserId,
      createdByRole: input.actorRole,
    }),
  );
}

export async function createTransferTopupRequest(
  repository: WalletRepository,
  input: {
    customerIdentifier: string;
    amount: number;
    submittedReference?: string;
    note?: string;
  },
): Promise<WalletTopupRequest> {
  validateAmount(input.amount);

  const wallet = await getOrCreateWallet(repository, input.customerIdentifier);

  return repository.createTopupRequest({
    walletId: wallet.id,
    method: 'transfer',
    requestedAmount: input.amount,
    status: 'pending',
    submittedReference: normalizeOptionalText(input.submittedReference),
    note: normalizeOptionalText(input.note),
  });
}

export async function approveManualTopupRequest(
  repository: WalletRepository,
  input: {
    topupRequestId: string;
    actorUserId: string;
    actorRole: WalletStaffRole;
    note?: string;
  },
) {
  validateSupportedRole(
    input.actorRole,
    MANUAL_TOPUP_REVIEW_ROLES,
    'Only owner or barista can approve manual top-ups.',
  );

  return repository.runInTransaction(async (txRepository) => {
    const request = await txRepository.getTopupRequestById(input.topupRequestId);
    if (!request) {
      throw new WalletTopupRequestNotFoundError('Wallet top-up request was not found.');
    }

    if (request.status !== 'pending') {
      throw new WalletConflictError('Only pending top-up requests can be approved.');
    }

    const reviewedAt = new Date().toISOString();
    const reviewedRequest = await txRepository.reviewTopupRequest({
      topupRequestId: request.id,
      status: 'approved',
      reviewedByUserId: input.actorUserId,
      reviewedAt,
      note: normalizeOptionalText(input.note) ?? request.note,
    });

    if (!reviewedRequest) {
      throw new WalletTopupRequestNotFoundError('Wallet top-up request was not found.');
    }

    const ledgerEntry = await txRepository.createLedgerEntry(
      buildLedgerEntry({
        walletId: request.walletId,
        entryType: mapTopupMethodToEntryType(request.method),
        amountSigned: request.requestedAmount,
        referenceType: 'manual_topup',
        referenceId: request.id,
        externalReference: request.submittedReference,
        note: normalizeOptionalText(input.note) ?? request.note,
        createdByUserId: input.actorUserId,
        createdByRole: input.actorRole,
      }),
    );

    return {
      request: reviewedRequest,
      ledgerEntry,
    };
  });
}

export async function rejectManualTopupRequest(
  repository: WalletRepository,
  input: {
    topupRequestId: string;
    actorUserId: string;
    actorRole: WalletStaffRole;
    note?: string;
  },
) {
  validateSupportedRole(
    input.actorRole,
    MANUAL_TOPUP_REVIEW_ROLES,
    'Only owner or barista can reject manual top-ups.',
  );

  const request = await repository.getTopupRequestById(input.topupRequestId);
  if (!request) {
    throw new WalletTopupRequestNotFoundError('Wallet top-up request was not found.');
  }

  if (request.status !== 'pending') {
    throw new WalletConflictError('Only pending top-up requests can be rejected.');
  }

  const reviewedRequest = await repository.reviewTopupRequest({
    topupRequestId: request.id,
    status: 'rejected',
    reviewedByUserId: input.actorUserId,
    reviewedAt: new Date().toISOString(),
    note: normalizeOptionalText(input.note) ?? request.note,
  });

  if (!reviewedRequest) {
    throw new WalletTopupRequestNotFoundError('Wallet top-up request was not found.');
  }

  return reviewedRequest;
}

export async function createAdminAdjustment(
  repository: WalletRepository,
  input: {
    customerIdentifier: string;
    direction: 'credit' | 'debit';
    amount: number;
    actorUserId: string;
    actorRole: WalletStaffRole;
    note: string;
    referenceId?: string;
    externalReference?: string;
  },
) {
  validateSupportedRole(
    input.actorRole,
    ADMIN_ADJUSTMENT_ROLES,
    'Only owner can create admin wallet adjustments.',
  );
  validateAmount(input.amount);

  const wallet = await getOrCreateWallet(repository, input.customerIdentifier);
  const note = normalizeOptionalText(input.note);
  requireNote(note, 'Admin adjustments require a reason or note.');

  if (input.direction === 'debit') {
    const currentBalance = await repository.getPostedBalance(wallet.id);
    if (currentBalance < input.amount) {
      throw new WalletInsufficientFundsError('Insufficient wallet balance for this debit.');
    }
  }

  return repository.createLedgerEntry(
    buildLedgerEntry({
      walletId: wallet.id,
      entryType:
        input.direction === 'credit' ? 'admin_adjustment_credit' : 'admin_adjustment_debit',
      amountSigned: input.direction === 'credit' ? input.amount : -input.amount,
      referenceType: 'admin_adjustment',
      referenceId: normalizeOptionalText(input.referenceId),
      externalReference: normalizeOptionalText(input.externalReference),
      note,
      createdByUserId: input.actorUserId,
      createdByRole: input.actorRole,
    }),
  );
}

export async function assertSufficientWalletBalance(
  repository: WalletRepository,
  input: { customerIdentifier: string; amount: number },
) {
  validateAmount(input.amount);

  const wallet = await getOrCreateWallet(repository, input.customerIdentifier);
  const currentBalance = await repository.getPostedBalance(wallet.id);

  if (currentBalance < input.amount) {
    throw new WalletInsufficientFundsError('Insufficient wallet balance for this debit.');
  }

  return {
    wallet,
    currentBalance,
  };
}

export async function createOrderPaymentDebit(
  repository: WalletRepository,
  input: {
    customerIdentifier: string;
    amount: number;
    orderReferenceId: string;
    actorUserId?: string;
    actorRole?: WalletActorRole;
    note?: string;
  },
) {
  validateAmount(input.amount);

  const { wallet } = await assertSufficientWalletBalance(repository, {
    customerIdentifier: input.customerIdentifier,
    amount: input.amount,
  });

  return repository.createLedgerEntry(
    buildLedgerEntry({
      walletId: wallet.id,
      entryType: 'order_payment',
      amountSigned: -input.amount,
      referenceType: 'order',
      referenceId: normalizeOptionalText(input.orderReferenceId),
      note: normalizeOptionalText(input.note),
      createdByUserId: normalizeOptionalText(input.actorUserId),
      createdByRole: input.actorRole ?? 'system',
    }),
  );
}

export async function createReferenceReversal(
  repository: WalletRepository,
  input: {
    customerIdentifier: string;
    referenceType: WalletReferenceType;
    referenceId: string;
    actorUserId?: string;
    actorRole?: WalletActorRole;
    note?: string;
  },
) {
  const wallet = await getWalletByCustomerIdentifier(repository, input.customerIdentifier);
  if (!wallet) {
    throw new WalletNotFoundError('Wallet was not found for the supplied customer key.');
  }

  const referenceId = normalizeCustomerIdentifier(input.referenceId);
  const referenceEntries = await repository.listReferenceEntries(
    wallet.id,
    input.referenceType,
    referenceId,
  );

  const existingReversal = referenceEntries.find(
    (entry) => entry.entryType === 'order_reversal' && entry.status === 'posted',
  );
  if (existingReversal) {
    throw new WalletConflictError('A posted reversal already exists for this reference.');
  }

  const netAmount = referenceEntries
    .filter((entry) => entry.status === 'posted')
    .reduce((sum, entry) => sum + entry.amountSigned, 0);

  if (netAmount >= 0) {
    throw new WalletValidationError('No posted debit exists to reverse for this reference.');
  }

  return repository.createLedgerEntry(
    buildLedgerEntry({
      walletId: wallet.id,
      entryType: 'order_reversal',
      amountSigned: Math.abs(netAmount),
      referenceType: input.referenceType,
      referenceId,
      note: normalizeOptionalText(input.note) ?? `Reversal for ${input.referenceType}:${referenceId}`,
      createdByUserId: normalizeOptionalText(input.actorUserId),
      createdByRole: input.actorRole ?? 'system',
    }),
  );
}
