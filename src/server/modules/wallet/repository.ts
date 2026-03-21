import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import {
  customerWallets,
  walletLedgerEntries,
  walletTopupRequests,
} from '@/server/db/schema';
import {
  CreateLedgerEntryInput,
  CreateTopupRequestInput,
  CreateWalletInput,
  CustomerWallet,
  ReviewTopupRequestInput,
  WalletActorRole,
  WalletCurrencyCode,
  WalletLedgerEntry,
  WalletReferenceType,
  WalletRepository,
  WalletTopupRequest,
} from '@/server/modules/wallet/types';

function mapWallet(row: typeof customerWallets.$inferSelect): CustomerWallet {
  return {
    id: row.id,
    customerIdentifier: row.customerIdentifier,
    currencyCode: row.currencyCode as WalletCurrencyCode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapLedgerEntry(row: typeof walletLedgerEntries.$inferSelect): WalletLedgerEntry {
  return {
    id: row.id,
    walletId: row.walletId,
    entryType: row.entryType,
    amountSigned: row.amountSigned,
    currencyCode: row.currencyCode as WalletCurrencyCode,
    status: row.status,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    externalReference: row.externalReference,
    note: row.note,
    createdByUserId: row.createdByUserId,
    createdByRole: row.createdByRole as WalletActorRole | null,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapTopupRequest(row: typeof walletTopupRequests.$inferSelect): WalletTopupRequest {
  return {
    id: row.id,
    walletId: row.walletId,
    method: row.method,
    requestedAmount: row.requestedAmount,
    status: row.status,
    submittedReference: row.submittedReference,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function makeWalletRepository(database?: ReturnType<typeof getDb> | any): WalletRepository {
  const resolveDatabase = () => database ?? getDb();

  return {
    async findWalletByCustomerIdentifier(customerIdentifier) {
      const rows = await resolveDatabase()
        .select()
        .from(customerWallets)
        .where(eq(customerWallets.customerIdentifier, customerIdentifier))
        .limit(1);

      return rows[0] ? mapWallet(rows[0]) : null;
    },

    async createWallet(input: CreateWalletInput) {
      try {
        const rows = await resolveDatabase().insert(customerWallets).values(input).returning();
        return mapWallet(rows[0]);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('customer_wallets_customer_identifier_unique_idx')
        ) {
          const existing = await this.findWalletByCustomerIdentifier(input.customerIdentifier);
          if (existing) {
            return existing;
          }
        }

        throw error;
      }
    },

    async getPostedBalance(walletId: string) {
      const rows = await resolveDatabase()
        .select({
          balance: sql<number>`COALESCE(SUM(${walletLedgerEntries.amountSigned}), 0)`,
        })
        .from(walletLedgerEntries)
        .where(and(eq(walletLedgerEntries.walletId, walletId), eq(walletLedgerEntries.status, 'posted')));

      return Number(rows[0]?.balance ?? 0);
    },

    async listLedgerEntries(walletId: string) {
      const rows = await resolveDatabase()
        .select()
        .from(walletLedgerEntries)
        .where(eq(walletLedgerEntries.walletId, walletId))
        .orderBy(desc(walletLedgerEntries.createdAt), desc(walletLedgerEntries.id));

      return rows.map(mapLedgerEntry);
    },

    async listReferenceEntries(walletId: string, referenceType: WalletReferenceType, referenceId: string) {
      const rows = await resolveDatabase()
        .select()
        .from(walletLedgerEntries)
        .where(
          and(
            eq(walletLedgerEntries.walletId, walletId),
            eq(walletLedgerEntries.referenceType, referenceType),
            eq(walletLedgerEntries.referenceId, referenceId),
          ),
        )
        .orderBy(desc(walletLedgerEntries.createdAt), desc(walletLedgerEntries.id));

      return rows.map(mapLedgerEntry);
    },

    async createLedgerEntry(input: CreateLedgerEntryInput) {
      const rows = await resolveDatabase().insert(walletLedgerEntries).values(input).returning();
      return mapLedgerEntry(rows[0]);
    },

    async createTopupRequest(input: CreateTopupRequestInput) {
      const rows = await resolveDatabase().insert(walletTopupRequests).values(input).returning();
      return mapTopupRequest(rows[0]);
    },

    async getTopupRequestById(topupRequestId: string) {
      const rows = await resolveDatabase()
        .select()
        .from(walletTopupRequests)
        .where(eq(walletTopupRequests.id, topupRequestId))
        .limit(1);

      return rows[0] ? mapTopupRequest(rows[0]) : null;
    },

    async reviewTopupRequest(input: ReviewTopupRequestInput) {
      const rows = await resolveDatabase()
        .update(walletTopupRequests)
        .set({
          status: input.status,
          reviewedByUserId: input.reviewedByUserId,
          reviewedAt: new Date(input.reviewedAt),
          note: input.note ?? null,
          updatedAt: new Date(input.reviewedAt),
        })
        .where(eq(walletTopupRequests.id, input.topupRequestId))
        .returning();

      return rows[0] ? mapTopupRequest(rows[0]) : null;
    },

    async runInTransaction<T>(callback: (repository: WalletRepository) => Promise<T>) {
      return resolveDatabase().transaction(async (tx: ReturnType<typeof getDb> | any) => {
        return callback(makeWalletRepository(tx));
      });
    },
  };
}

export const walletRepository = makeWalletRepository();
