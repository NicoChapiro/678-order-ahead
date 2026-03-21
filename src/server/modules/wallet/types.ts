export const FIXED_WALLET_CURRENCY = 'CLP' as const;

export type WalletCurrencyCode = typeof FIXED_WALLET_CURRENCY;
export type WalletStaffRole = 'owner' | 'barista';
export type WalletActorRole = WalletStaffRole | 'system';

export type WalletEntryType =
  | 'topup_card'
  | 'topup_transfer'
  | 'topup_cashier'
  | 'topup_mercado_pago'
  | 'admin_adjustment_credit'
  | 'admin_adjustment_debit'
  | 'order_payment'
  | 'order_reversal';

export type WalletEntryStatus = 'posted' | 'pending' | 'cancelled';

export type WalletReferenceType = 'manual_topup' | 'cashier_topup' | 'admin_adjustment' | 'order';

export type WalletTopupMethod = 'card' | 'transfer' | 'cashier' | 'mercado_pago';
export type WalletTopupRequestStatus = 'pending' | 'approved' | 'rejected';

export type CustomerWallet = {
  id: string;
  customerIdentifier: string;
  currencyCode: WalletCurrencyCode;
  createdAt: string;
  updatedAt: string;
};

export type WalletLedgerEntry = {
  id: string;
  walletId: string;
  entryType: WalletEntryType;
  amountSigned: number;
  currencyCode: WalletCurrencyCode;
  status: WalletEntryStatus;
  referenceType: WalletReferenceType | null;
  referenceId: string | null;
  externalReference: string | null;
  note: string | null;
  createdByUserId: string | null;
  createdByRole: WalletActorRole | null;
  createdAt: string;
};

export type WalletTopupRequest = {
  id: string;
  walletId: string;
  method: WalletTopupMethod;
  requestedAmount: number;
  status: WalletTopupRequestStatus;
  submittedReference: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WalletSummary = {
  wallet: CustomerWallet;
  currentBalance: number;
};

export type CreateWalletInput = {
  customerIdentifier: string;
  currencyCode: WalletCurrencyCode;
};

export type CreateLedgerEntryInput = {
  walletId: string;
  entryType: WalletEntryType;
  amountSigned: number;
  currencyCode: WalletCurrencyCode;
  status: WalletEntryStatus;
  referenceType?: WalletReferenceType | null;
  referenceId?: string | null;
  externalReference?: string | null;
  note?: string | null;
  createdByUserId?: string | null;
  createdByRole?: WalletActorRole | null;
};

export type CreateTopupRequestInput = {
  walletId: string;
  method: WalletTopupMethod;
  requestedAmount: number;
  status: WalletTopupRequestStatus;
  submittedReference?: string | null;
  note?: string | null;
};

export type ReviewTopupRequestInput = {
  topupRequestId: string;
  status: Exclude<WalletTopupRequestStatus, 'pending'>;
  reviewedByUserId: string;
  reviewedAt: string;
  note?: string | null;
};

export type WalletRepository = {
  findWalletByCustomerIdentifier(customerIdentifier: string): Promise<CustomerWallet | null>;
  createWallet(input: CreateWalletInput): Promise<CustomerWallet>;
  getPostedBalance(walletId: string): Promise<number>;
  listLedgerEntries(walletId: string): Promise<WalletLedgerEntry[]>;
  listReferenceEntries(
    walletId: string,
    referenceType: WalletReferenceType,
    referenceId: string,
  ): Promise<WalletLedgerEntry[]>;
  createLedgerEntry(input: CreateLedgerEntryInput): Promise<WalletLedgerEntry>;
  createTopupRequest(input: CreateTopupRequestInput): Promise<WalletTopupRequest>;
  getTopupRequestById(topupRequestId: string): Promise<WalletTopupRequest | null>;
  reviewTopupRequest(input: ReviewTopupRequestInput): Promise<WalletTopupRequest | null>;
  runInTransaction<T>(callback: (repository: WalletRepository) => Promise<T>): Promise<T>;
};
