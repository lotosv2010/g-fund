import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { CreateTransactionDto } from './dto/create-transaction.dto';

type DbType = NodePgDatabase<typeof schema>;
type TransactionRow = typeof schema.transactions.$inferSelect;
type PositionRow = typeof schema.positions.$inferSelect;

@Injectable()
export class TransactionsService {
  constructor(@Inject(DB) private readonly db: DbType) {}

  async findAll(fundCode?: string, type?: string): Promise<TransactionRow[]> {
    const conditions = [];
    if (fundCode) conditions.push(eq(schema.transactions.fundCode, fundCode));
    if (type) conditions.push(eq(schema.transactions.type, type));

    let query = this.db.select().from(schema.transactions);
    if (conditions.length > 0) {
      query = query.where(conditions[0]) as typeof query;
    }
    return query.orderBy(desc(schema.transactions.tradeDate));
  }

  async create(dto: CreateTransactionDto): Promise<TransactionRow> {
    const [fund] = await this.db
      .select()
      .from(schema.funds)
      .where(eq(schema.funds.code, dto.fundCode));
    if (!fund) throw new NotFoundException(`基金 ${dto.fundCode} 不存在`);

    return this.db.transaction(async (tx) => {
      const [txRow] = await tx
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
        })
        .returning();

      if (dto.type === 'buy') {
        await this.handleBuy(tx, dto, fund.name);
      } else {
        await this.handleSell(tx, dto, fund.name);
      }

      return txRow;
    });
  }

  private async handleBuy(
    tx: Parameters<Parameters<DbType['transaction']>[0]>[0],
    dto: CreateTransactionDto,
    fundName: string,
  ): Promise<void> {
    const [existing] = await tx
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.fundCode, dto.fundCode));

    const buyAmount = parseFloat(dto.amount);
    const buyShares = dto.shares ? parseFloat(dto.shares) : 0;
    const buyPrice = dto.price ? parseFloat(dto.price) : buyShares > 0 ? buyAmount / buyShares : 0;

    if (existing) {
      const oldShares = parseFloat(existing.shares ?? '0');
      const oldCostPrice = parseFloat(existing.costPrice);
      const newShares = oldShares + buyShares;
      const newCostAmount = parseFloat(existing.costAmount) + buyAmount;
      const newCostPrice = newShares > 0 ? newCostAmount / newShares : oldCostPrice;

      await tx
        .update(schema.positions)
        .set({
          shares: newShares.toFixed(4),
          costPrice: newCostPrice.toFixed(4),
          costAmount: newCostAmount.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(schema.positions.fundCode, dto.fundCode));
    } else {
      const costPrice = buyShares > 0 ? buyAmount / buyShares : 0;
      await tx.insert(schema.positions).values({
        fundCode: dto.fundCode,
        fundName,
        shares: buyShares.toFixed(4),
        costPrice: costPrice.toFixed(4),
        costAmount: buyAmount.toFixed(2),
      });
    }
  }

  private async handleSell(
    tx: Parameters<Parameters<DbType['transaction']>[0]>[0],
    dto: CreateTransactionDto,
    fundName: string,
  ): Promise<void> {
    const [existing] = await tx
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.fundCode, dto.fundCode));

    if (!existing) throw new BadRequestException(`基金 ${dto.fundCode} 无持仓，无法卖出`);

    const sellShares = dto.shares ? parseFloat(dto.shares) : 0;
    const oldShares = parseFloat(existing.shares ?? '0');

    if (sellShares > oldShares) {
      throw new BadRequestException(
        `卖出份额 ${sellShares} 超过持有份额 ${oldShares}`,
      );
    }

    const oldCostPrice = parseFloat(existing.costPrice);
    const newShares = oldShares - sellShares;
    const newCostAmount = newShares * oldCostPrice;

    if (newShares <= 0) {
      await tx
        .delete(schema.positions)
        .where(eq(schema.positions.fundCode, dto.fundCode));
    } else {
      await tx
        .update(schema.positions)
        .set({
          shares: newShares.toFixed(4),
          costAmount: newCostAmount.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(schema.positions.fundCode, dto.fundCode));
    }
  }

  async remove(id: number): Promise<void> {
    const [txRow] = await this.db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, id));
    if (!txRow) throw new NotFoundException(`交易记录 ${id} 不存在`);

    await this.db.transaction(async (tx) => {
      if (txRow.type === 'buy') {
        await this.rollbackBuy(tx, txRow);
      } else {
        await this.rollbackSell(tx, txRow);
      }
      await tx.delete(schema.transactions).where(eq(schema.transactions.id, id));
    });
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
    const newShares = oldShares - rollbackShares;
    const newCostAmount = oldCostAmount - rollbackAmount;

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
      const newShares = oldShares + rollbackShares;
      const newCostAmount = oldCostAmount + rollbackAmount;
      const newCostPrice = newShares > 0 ? newCostAmount / newShares : 0;

      await tx
        .update(schema.positions)
        .set({
          shares: newShares.toFixed(4),
          costPrice: newCostPrice.toFixed(4),
          costAmount: newCostAmount.toFixed(2),
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
      });
    }
  }
}
