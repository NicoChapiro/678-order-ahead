import { describe, expect, it } from 'vitest';
import {
  assertSufficientWalletBalance,
  createAdminAdjustment,
  createCashierTopup,
  createOrderPaymentDebit,
  createReferenceReversal,
  getWalletSummary,
  listWalletTransactions,
  WalletInsufficientFundsError,
  WalletPermissionError,
  WalletValidationError,
} from '@/server/modules/wallet/service';
import {
  CreateLedgerEntryInput,
  CreateTopupRequestInput,
  CreateWalletInput,
  CustomerWallet,
  ReviewTopupRequestInput,
  WalletLedgerEntry,
  WalletReferenceType,
  WalletRepository,
  WalletTopupRequest,
} from '@/server/modules/wallet/types';

class InMemoryWalletRepository implements WalletRepository {
  private walletSeq = 1;
  private ledgerSeq = 1;
  private topupSeq = 1;
  private tick = 0;

  wallets: CustomerWallet[] = [];
  ledgerEntries: WalletLedgerEntry[] = [];
  topupRequests: WalletTopupRequest[] = [];

  private nextDate() {
    this.tick += 1;
    return new Date(Date.UTC(2026, 0, 1, 0, 0, this.tick)).toISOString();
  }

  async findWalletByCustomerIdentifier(customerIdentifier: string) {
    return this.wallets.find((wallet) => wallet.customerIdentifier === customerIdentifier) ?? null;
  }

  async createWallet(input: CreateWalletInput) {
    const existing = await this.findWalletByCustomerIdentifier(input.customerIdentifier);
    if (existing) {
      return existing;
    }

    const now = this.nextDate();
    const wallet: CustomerWallet = {
      id: `wallet-${this.walletSeq++}`,
      customerIdentifier: input.customerIdentifier,
      currencyCode: input.currencyCode,
      createdAt: now,
      updatedAt: now,
    };
    this.wallets.push(wallet);
    return wallet;
  }

  async getPostedBalance(walletId: string) {
    return this.ledgerEntries
      .filter((entry) => entry.walletId === walletId && entry.status === 'posted')
      .reduce((sum, entry) => sum + entry.amountSigned, 0);
  }

  async listLedgerEntries(walletId: string) {
    return [...this.ledgerEntries]
      .filter((entry) => entry.walletId === walletId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listReferenceEntries(walletId: string, referenceType: WalletReferenceType, referenceId: string) {
    return this.ledgerEntries.filter(
      (entry) =>
        entry.walletId === walletId &&
        entry.referenceType === referenceType &&
        entry.referenceId === referenceId,
    );
  }

  async createLedgerEntry(input: CreateLedgerEntryInput) {
    const entry: WalletLedgerEntry = {
      id: `entry-${this.ledgerSeq++}`,
      walletId: input.walletId,
      entryType: input.entryType,
      amountSigned: input.amountSigned,
      currencyCode: input.currencyCode,
      status: input.status,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      externalReference: input.externalReference ?? null,
      note: input.note ?? null,
      createdByUserId: input.createdByUserId ?? null,
      createdByRole: input.createdByRole ?? null,
      createdAt: this.nextDate(),
    };
    this.ledgerEntries.push(entry);
    return entry;
  }

  async createTopupRequest(input: CreateTopupRequestInput) {
    const now = this.nextDate();
    const request: WalletTopupRequest = {
      id: `topup-${this.topupSeq++}`,
      walletId: input.walletId,
      method: input.method,
      requestedAmount: input.requestedAmount,
      status: input.status,
      submittedReference: input.submittedReference ?? null,
      reviewedByUserId: null,
      reviewedAt: null,
      note: input.note ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.topupRequests.push(request);
    return request;
  }

  async getTopupRequestById(topupRequestId: string) {
    return this.topupRequests.find((request) => request.id === topupRequestId) ?? null;
  }

  async reviewTopupRequest(input: ReviewTopupRequestInput) {
    const request = this.topupRequests.find((item) => item.id === input.topupRequestId) ?? null;
    if (!request) {
      return null;
    }

    request.status = input.status;
    request.reviewedByUserId = input.reviewedByUserId;
    request.reviewedAt = input.reviewedAt;
    request.note = input.note ?? null;
    request.updatedAt = input.reviewedAt;
    return request;
  }

  async runInTransaction<T>(callback: (repository: WalletRepository) => Promise<T>): Promise<T> {
    return callback(this);
  }
}

describe('wallet service', () => {

  it('computes balance from posted ledger entries only', async () => {
    const repository = new InMemoryWalletRepository();
    const wallet = await repository.createWallet({
      customerIdentifier: 'customer-1',
      currencyCode: 'CLP',
    });

    await repository.createLedgerEntry({
      walletId: wallet.id,
      entryType: 'topup_cashier',
      amountSigned: 10000,
      currencyCode: 'CLP',
      status: 'posted',
    });
    await repository.createLedgerEntry({
      walletId: wallet.id,
      entryType: 'admin_adjustment_debit',
      amountSigned: -1500,
      currencyCode: 'CLP',
      status: 'posted',
    });
    await repository.createLedgerEntry({
      walletId: wallet.id,
      entryType: 'topup_transfer',
      amountSigned: 7000,
      currencyCode: 'CLP',
      status: 'cancelled',
    });

    const summary = await getWalletSummary(repository, 'customer-1');
    expect(summary.currentBalance).toBe(8500);
  });

  it('ignores pending entries when computing available balance', async () => {
    const repository = new InMemoryWalletRepository();
    const wallet = await repository.createWallet({
      customerIdentifier: 'customer-2',
      currencyCode: 'CLP',
    });

    await repository.createLedgerEntry({
      walletId: wallet.id,
      entryType: 'topup_cashier',
      amountSigned: 6000,
      currencyCode: 'CLP',
      status: 'posted',
    });
    await repository.createLedgerEntry({
      walletId: wallet.id,
      entryType: 'topup_transfer',
      amountSigned: 4000,
      currencyCode: 'CLP',
      status: 'pending',
    });

    const result = await assertSufficientWalletBalance(repository, {
      customerIdentifier: 'customer-2',
      amount: 6000,
    });

    expect(result.currentBalance).toBe(6000);
  });

  it('cashier top-up increases balance', async () => {
    const repository = new InMemoryWalletRepository();

    await createCashierTopup(repository, {
      customerIdentifier: 'customer-3',
      amount: 9000,
      actorUserId: 'barista-1',
      actorRole: 'barista',
      note: 'Caja mañana',
    });

    const summary = await getWalletSummary(repository, 'customer-3');
    expect(summary.currentBalance).toBe(9000);
  });

  it('owner admin debit decreases balance', async () => {
    const repository = new InMemoryWalletRepository();

    await createCashierTopup(repository, {
      customerIdentifier: 'customer-4',
      amount: 12000,
      actorUserId: 'owner-1',
      actorRole: 'owner',
    });

    await createAdminAdjustment(repository, {
      customerIdentifier: 'customer-4',
      direction: 'debit',
      amount: 2000,
      actorUserId: 'owner-1',
      actorRole: 'owner',
      note: 'Regularización manual',
    });

    const summary = await getWalletSummary(repository, 'customer-4');
    expect(summary.currentBalance).toBe(10000);
  });

  it('barista cannot create owner-only admin debit adjustments', async () => {
    const repository = new InMemoryWalletRepository();

    await createCashierTopup(repository, {
      customerIdentifier: 'customer-5',
      amount: 12000,
      actorUserId: 'owner-1',
      actorRole: 'owner',
    });

    await expect(
      createAdminAdjustment(repository, {
        customerIdentifier: 'customer-5',
        direction: 'debit',
        amount: 1000,
        actorUserId: 'barista-1',
        actorRole: 'barista',
        note: 'No permitido',
      }),
    ).rejects.toBeInstanceOf(WalletPermissionError);
  });

  it('rejects debit helper when wallet has insufficient funds', async () => {
    const repository = new InMemoryWalletRepository();

    await createCashierTopup(repository, {
      customerIdentifier: 'customer-6',
      amount: 3000,
      actorUserId: 'owner-1',
      actorRole: 'owner',
    });

    await expect(
      createOrderPaymentDebit(repository, {
        customerIdentifier: 'customer-6',
        amount: 4000,
        orderReferenceId: 'order-1',
      }),
    ).rejects.toBeInstanceOf(WalletInsufficientFundsError);
  });

  it('reversal restores balance correctly', async () => {
    const repository = new InMemoryWalletRepository();

    await createCashierTopup(repository, {
      customerIdentifier: 'customer-7',
      amount: 15000,
      actorUserId: 'owner-1',
      actorRole: 'owner',
    });
    await createOrderPaymentDebit(repository, {
      customerIdentifier: 'customer-7',
      amount: 6500,
      orderReferenceId: 'order-7',
    });

    let summary = await getWalletSummary(repository, 'customer-7');
    expect(summary.currentBalance).toBe(8500);

    await createReferenceReversal(repository, {
      customerIdentifier: 'customer-7',
      referenceType: 'order',
      referenceId: 'order-7',
      note: 'Pedido cancelado',
    });

    summary = await getWalletSummary(repository, 'customer-7');
    expect(summary.currentBalance).toBe(15000);
  });

  it('returns transaction history in descending chronological order', async () => {
    const repository = new InMemoryWalletRepository();

    await createCashierTopup(repository, {
      customerIdentifier: 'customer-8',
      amount: 1000,
      actorUserId: 'owner-1',
      actorRole: 'owner',
      note: 'Primero',
    });
    await createAdminAdjustment(repository, {
      customerIdentifier: 'customer-8',
      direction: 'credit',
      amount: 500,
      actorUserId: 'owner-1',
      actorRole: 'owner',
      note: 'Segundo',
    });

    const history = await listWalletTransactions(repository, 'customer-8');
    expect(history.transactions).toHaveLength(2);
    expect(history.transactions[0]?.note).toBe('Segundo');
    expect(history.transactions[1]?.note).toBe('Primero');
  });

  it('rejects invalid amounts', async () => {
    const repository = new InMemoryWalletRepository();

    await expect(
      createCashierTopup(repository, {
        customerIdentifier: 'customer-9',
        amount: 0,
        actorUserId: 'owner-1',
        actorRole: 'owner',
      }),
    ).rejects.toBeInstanceOf(WalletValidationError);
  });



});
