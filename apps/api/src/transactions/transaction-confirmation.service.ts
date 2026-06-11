import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, and, lt, asc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';

type DbType = NodePgDatabase<typeof schema>;
type TransactionRow = typeof schema.transactions.$inferSelect;
type PositionRow = typeof schema.positions.$inferSelect;

@Injectable()
export class TransactionConfirmationService {
  private readonly logger = new Logger(TransactionConfirmationService.name);

  constructor(@Inject(DB) private readonly db: DbType) {}

  async confirmPending(fundCode: string, navUnit: string): Promise<number> {
    const nav = parseFloat(navUnit);
    if (!Number.isFinite(nav) || nav <= 0) return 0;

    const today = new Date().toISOString().slice(0, 10);
    const pendingTxs = await this.db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.fundCode, fundCode),
          eq(schema.transactions.status, 'pending'),
          lt(schema.transactions.tradeDate, today),
        ),
      )
      .orderBy(asc(schema.transactions.tradeDate));

    if (pendingTxs.length === 0) return 0;

    for (const tx of pendingTxs) {
      await this.db.transaction(async (dbTx) => {
        if (tx.type === 'buy') {
          await this.confirmBuy(dbTx, tx, nav);
        } else {
          await this.confirmSell(dbTx, tx, nav);
        }

        await dbTx
          .update(schema.transactions)
          .set({
            status: 'confirmed',
            shares: tx.type === 'buy' ? (parseFloat(tx.amount) / nav).toFixed(4) : tx.shares,
            price: nav.toFixed(4),
            confirmedAt: new Date(),
          })
          .where(eq(schema.transactions.id, tx.id));
      });
    }

    return pendingTxs.length;
  }

  private async confirmBuy(
    dbTx: Parameters<Parameters<DbType['transaction']>[0]>[0],
    tx: TransactionRow,
    nav: number,
  ): Promise<void> {
    const buyAmount = parseFloat(tx.amount);
    const buyShares = buyAmount / nav;

    const [existing] = await dbTx
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.fundCode, tx.fundCode));

    if (existing) {
      const oldShares = parseFloat(existing.shares ?? '0');
      const newShares = oldShares + buyShares;
      const newCostAmount = parseFloat(existing.costAmount) + buyAmount;
      const newCostPrice = newShares > 0 ? newCostAmount / newShares : 0;
      const newCurrentValue = parseFloat(existing.currentValue ?? '0') + buyShares * nav;

      await dbTx
        .update(schema.positions)
        .set({
          shares: newShares.toFixed(4),
          costPrice: newCostPrice.toFixed(4),
          costAmount: newCostAmount.toFixed(2),
          currentValue: newCurrentValue.toFixed(2),
          navUnit: nav.toFixed(4),
          updatedAt: new Date(),
        })
        .where(eq(schema.positions.fundCode, tx.fundCode));
    } else {
      await dbTx.insert(schema.positions).values({
        fundCode: tx.fundCode,
        fundName: tx.fundName,
        shares: buyShares.toFixed(4),
        costPrice: nav.toFixed(4),
        costAmount: buyAmount.toFixed(2),
        currentValue: (buyShares * nav).toFixed(2),
        navUnit: nav.toFixed(4),
      });
    }
  }

  private async confirmSell(
    dbTx: Parameters<Parameters<DbType['transaction']>[0]>[0],
    tx: TransactionRow,
    nav: number,
  ): Promise<void> {
    const [existing] = await dbTx
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.fundCode, tx.fundCode));

    if (!existing) {
      await dbTx
        .update(schema.transactions)
        .set({ status: 'cancelled', confirmedAt: new Date() })
        .where(eq(schema.transactions.id, tx.id));
      return;
    }

    const sellAmount = parseFloat(tx.amount);
    const sellShares = sellAmount / nav;
    const oldShares = parseFloat(existing.shares ?? '0');

    if (sellShares > oldShares) {
      await dbTx
        .update(schema.transactions)
        .set({ status: 'cancelled', confirmedAt: new Date() })
        .where(eq(schema.transactions.id, tx.id));
      return;
    }

    const oldCostPrice = parseFloat(existing.costPrice);
    const newShares = oldShares - sellShares;
    const newCostAmount = newShares * oldCostPrice;
    const newCurrentValue = Math.max(0, parseFloat(existing.currentValue ?? '0') - sellShares * nav);

    if (newShares <= 0) {
      await dbTx.delete(schema.positions).where(eq(schema.positions.fundCode, tx.fundCode));
    } else {
      await dbTx
        .update(schema.positions)
        .set({
          shares: newShares.toFixed(4),
          costAmount: newCostAmount.toFixed(2),
          currentValue: newCurrentValue.toFixed(2),
          navUnit: nav.toFixed(4),
          updatedAt: new Date(),
        })
        .where(eq(schema.positions.fundCode, tx.fundCode));
    }
  }
}
