import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, gte, lte, lt, asc, desc, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FundsService } from '../funds/funds.service';

type DbType = NodePgDatabase<typeof schema>;
type TransactionRow = typeof schema.transactions.$inferSelect;
type PositionRow = typeof schema.positions.$inferSelect;

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(DB) private readonly db: DbType,
    private readonly fundsService: FundsService,
  ) {}

  async findAll(fundCode?: string, type?: string, startDate?: string, endDate?: string): Promise<TransactionRow[]> {
    const conditions: SQL[] = [];
    if (fundCode) conditions.push(eq(schema.transactions.fundCode, fundCode));
    if (type) conditions.push(eq(schema.transactions.type, type));
    if (startDate) conditions.push(gte(schema.transactions.tradeDate, startDate));
    if (endDate) conditions.push(lte(schema.transactions.tradeDate, endDate));

    let query = this.db.select().from(schema.transactions);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    return query.orderBy(desc(schema.transactions.tradeDate));
  }

  async create(dto: CreateTransactionDto): Promise<TransactionRow> {
    const [fund] = await this.db
      .select()
      .from(schema.funds)
      .where(eq(schema.funds.code, dto.fundCode));
    if (!fund) throw new NotFoundException(`基金 ${dto.fundCode} 不存在`);

    const [txRow] = await this.db
      .insert(schema.transactions)
      .values({
        fundCode: dto.fundCode,
        fundName: fund.name,
        type: dto.type,
        amount: dto.amount,
        shares: dto.shares ?? null,
        price: dto.price ?? null,
        tradeDate: dto.tradeDate,
        note: dto.note ?? null,
        status: 'pending',
      })
      .returning();

    return txRow;
  }

  async confirmPending(fundCode: string, navUnit: string, navDate?: string): Promise<number> {
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

    const nav = parseFloat(navUnit);
    if (!Number.isFinite(nav) || nav <= 0) return 0;

    for (const tx of pendingTxs) {
      await this.db.transaction(async (dbTx) => {
        await this.confirmTransaction(dbTx, tx, nav, navDate);
      });
    }

    await this.fundsService.computeLifecycleStage(fundCode).catch(() => {});

    return pendingTxs.length;
  }

  private async confirmTransaction(
    tx: Parameters<Parameters<DbType['transaction']>[0]>[0],
    txRow: TransactionRow,
    navUnit: number,
    navDate?: string,
  ): Promise<void> {
    if (txRow.type === 'buy') {
      await this.confirmBuy(tx, txRow, navUnit);
    } else {
      await this.confirmSell(tx, txRow, navUnit);
    }

    await tx
      .update(schema.transactions)
      .set({
        status: 'confirmed',
        price: navUnit.toFixed(4),
        confirmedAt: new Date(),
      })
      .where(eq(schema.transactions.id, txRow.id));
  }

  private async confirmBuy(
    tx: Parameters<Parameters<DbType['transaction']>[0]>[0],
    txRow: TransactionRow,
    navUnit: number,
  ): Promise<void> {
    const buyAmount = parseFloat(txRow.amount);
    const buyShares = buyAmount / navUnit;

    const [existing] = await tx
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.fundCode, txRow.fundCode));

    if (existing) {
      const oldShares = parseFloat(existing.shares ?? '0');
      const newShares = oldShares + buyShares;
      const newCostAmount = parseFloat(existing.costAmount) + buyAmount;
      const newCostPrice = newShares > 0 ? newCostAmount / newShares : 0;
      const newCurrentValue = parseFloat(existing.currentValue ?? '0') + buyShares * navUnit;

      await tx
        .update(schema.positions)
        .set({
          shares: newShares.toFixed(4),
          costPrice: newCostPrice.toFixed(4),
          costAmount: newCostAmount.toFixed(2),
          currentValue: newCurrentValue.toFixed(2),
          navUnit: navUnit.toFixed(4),
          updatedAt: new Date(),
        })
        .where(eq(schema.positions.fundCode, txRow.fundCode));
    } else {
      const costPrice = navUnit;
      await tx.insert(schema.positions).values({
        fundCode: txRow.fundCode,
        fundName: txRow.fundName,
        shares: buyShares.toFixed(4),
        costPrice: costPrice.toFixed(4),
        costAmount: buyAmount.toFixed(2),
        currentValue: (buyShares * navUnit).toFixed(2),
        navUnit: navUnit.toFixed(4),
      });
    }

    await tx
      .update(schema.transactions)
      .set({ shares: buyShares.toFixed(4) })
      .where(eq(schema.transactions.id, txRow.id));
  }

  private async confirmSell(
    tx: Parameters<Parameters<DbType['transaction']>[0]>[0],
    txRow: TransactionRow,
    navUnit: number,
  ): Promise<void> {
    const [existing] = await tx
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.fundCode, txRow.fundCode));

    if (!existing) {
      await tx
        .update(schema.transactions)
        .set({ status: 'cancelled', confirmedAt: new Date() })
        .where(eq(schema.transactions.id, txRow.id));
      return;
    }

    const sellAmount = parseFloat(txRow.amount);
    const sellShares = sellAmount / navUnit;
    const oldShares = parseFloat(existing.shares ?? '0');

    if (sellShares > oldShares) {
      await tx
        .update(schema.transactions)
        .set({ status: 'cancelled', confirmedAt: new Date() })
        .where(eq(schema.transactions.id, txRow.id));
      return;
    }

    const oldCostPrice = parseFloat(existing.costPrice);
    const newShares = oldShares - sellShares;
    const newCostAmount = newShares * oldCostPrice;
    const newCurrentValue = Math.max(0, parseFloat(existing.currentValue ?? '0') - sellShares * navUnit);

    if (newShares <= 0) {
      await tx
        .delete(schema.positions)
        .where(eq(schema.positions.fundCode, txRow.fundCode));
    } else {
      await tx
        .update(schema.positions)
        .set({
          shares: newShares.toFixed(4),
          costAmount: newCostAmount.toFixed(2),
          currentValue: newCurrentValue.toFixed(2),
          navUnit: navUnit.toFixed(4),
          updatedAt: new Date(),
        })
        .where(eq(schema.positions.fundCode, txRow.fundCode));
    }

    await tx
      .update(schema.transactions)
      .set({ shares: sellShares.toFixed(4), price: navUnit.toFixed(4) })
      .where(eq(schema.transactions.id, txRow.id));
  }

  async remove(id: number): Promise<void> {
    const [txRow] = await this.db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, id));
    if (!txRow) throw new NotFoundException(`交易记录 ${id} 不存在`);

    if (txRow.status === 'pending') {
      await this.db.delete(schema.transactions).where(eq(schema.transactions.id, id));
      return;
    }

    await this.db.transaction(async (tx) => {
      if (txRow.type === 'buy') {
        await this.rollbackBuy(tx, txRow);
      } else {
        await this.rollbackSell(tx, txRow);
      }
      await tx.delete(schema.transactions).where(eq(schema.transactions.id, id));
    });

    await this.fundsService.computeLifecycleStage(txRow.fundCode).catch(() => {});
  }

  private async rollbackBuy(
    tx: Parameters<Parameters<DbType['transaction']>[0]>[0],
    txRow: TransactionRow,
  ): Promise<void> {
    const [position] = await tx
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.fundCode, txRow.fundCode));
    if (!position) return;

    const rollbackShares = txRow.shares ? parseFloat(txRow.shares) : 0;
    const rollbackAmount = parseFloat(txRow.amount);
    const oldShares = parseFloat(position.shares ?? '0');
    const oldCostAmount = parseFloat(position.costAmount);
    const oldCurrentValue = parseFloat(position.currentValue ?? '0');
    const newShares = oldShares - rollbackShares;
    const newCostAmount = oldCostAmount - rollbackAmount;
    const newCurrentValue = Math.max(0, oldCurrentValue - rollbackAmount);

    if (newShares <= 0) {
      await tx
        .delete(schema.positions)
        .where(eq(schema.positions.fundCode, txRow.fundCode));
    } else {
      const newCostPrice = newShares > 0 ? newCostAmount / newShares : 0;
      await tx
        .update(schema.positions)
        .set({
          shares: newShares.toFixed(4),
          costPrice: newCostPrice.toFixed(4),
          costAmount: newCostAmount.toFixed(2),
          currentValue: newCurrentValue.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(schema.positions.fundCode, txRow.fundCode));
    }
  }

  private async rollbackSell(
    tx: Parameters<Parameters<DbType['transaction']>[0]>[0],
    txRow: TransactionRow,
  ): Promise<void> {
    const [position] = await tx
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.fundCode, txRow.fundCode));

    const rollbackShares = txRow.shares ? parseFloat(txRow.shares) : 0;
    const rollbackAmount = parseFloat(txRow.amount);
    const rollbackPrice = txRow.price ? parseFloat(txRow.price) : 0;

    if (position) {
      const oldShares = parseFloat(position.shares ?? '0');
      const oldCostAmount = parseFloat(position.costAmount);
      const oldCurrentValue = parseFloat(position.currentValue ?? '0');
      const newShares = oldShares + rollbackShares;
      const newCostAmount = oldCostAmount + rollbackAmount;
      const newCostPrice = newShares > 0 ? newCostAmount / newShares : 0;
      const restoredValue = rollbackPrice > 0 ? rollbackShares * rollbackPrice : rollbackAmount;
      const newCurrentValue = oldCurrentValue + restoredValue;
      const newNavUnit = newShares > 0 ? newCurrentValue / newShares : 0;

      await tx
        .update(schema.positions)
        .set({
          shares: newShares.toFixed(4),
          costPrice: newCostPrice.toFixed(4),
          costAmount: newCostAmount.toFixed(2),
          currentValue: newCurrentValue.toFixed(2),
          navUnit: newNavUnit.toFixed(4),
          updatedAt: new Date(),
        })
        .where(eq(schema.positions.fundCode, txRow.fundCode));
    } else {
      const costPrice = rollbackShares > 0 ? rollbackAmount / rollbackShares : 0;
      await tx.insert(schema.positions).values({
        fundCode: txRow.fundCode,
        fundName: txRow.fundName,
        shares: rollbackShares.toFixed(4),
        costPrice: costPrice.toFixed(4),
        costAmount: rollbackAmount.toFixed(2),
        currentValue: rollbackAmount.toFixed(2),
        navUnit: costPrice > 0 ? costPrice.toFixed(4) : null,
      });
    }
  }
}
