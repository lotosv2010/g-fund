import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, gte, lte, lt, asc, desc, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ImportTransactionRow, ImportResult, ImportError } from '@g-fund/types';
import { FundsService } from '../funds/funds.service';
import { TransactionConfirmationService } from './transaction-confirmation.service';
import { CsvImportService } from './csv-import.service';

type DbType = NodePgDatabase<typeof schema>;
type TransactionRow = typeof schema.transactions.$inferSelect;
type PositionRow = typeof schema.positions.$inferSelect;

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(DB) private readonly db: DbType,
    private readonly fundsService: FundsService,
    private readonly confirmationService: TransactionConfirmationService,
    private readonly csvImportService: CsvImportService,
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

  async confirmPending(fundCode: string, navUnit: string): Promise<number> {
    const count = await this.confirmationService.confirmPending(fundCode, navUnit);
    if (count > 0) {
      await this.recordStageChangeIfNeeded(fundCode, 'buy');
    }
    return count;
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

    // 回滚后记录阶段变化
    const trigger = txRow.type === 'buy' ? 'rollback_buy' : 'rollback_sell';
    await this.recordStageChangeIfNeeded(txRow.fundCode, trigger);
  }

  async importFromCsv(content: string, format?: string): Promise<ImportResult> {
    const rows = this.csvImportService.parseCsv(content, format);
    const errors: ImportError[] = [];
    const created: TransactionRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const [fund] = await this.db
          .select()
          .from(schema.funds)
          .where(eq(schema.funds.code, row.fundCode));

        if (!fund) {
          errors.push({
            row: i + 2,
            field: 'fundCode',
            message: `基金 ${row.fundCode} 不存在，请先添加基金`,
          });
          continue;
        }

        const [txRow] = await this.db
          .insert(schema.transactions)
          .values({
            fundCode: row.fundCode,
            fundName: fund.name,
            type: row.type,
            amount: row.amount.toFixed(2),
            shares: row.shares?.toFixed(4) ?? null,
            price: row.price?.toFixed(4) ?? null,
            tradeDate: row.tradeDate,
            note: row.note ?? null,
            status: 'pending',
          })
          .returning();

        created.push(txRow);
      } catch (err) {
        errors.push({
          row: i + 2,
          field: 'unknown',
          message: err instanceof Error ? err.message : '导入失败',
        });
      }
    }

    return {
      total: rows.length,
      succeeded: created.length,
      failed: errors.length,
      errors,
      created: created.map(row => ({
        ...row,
        type: row.type as 'buy' | 'sell',
        status: row.status as 'pending' | 'confirmed' | 'cancelled',
        confirmedAt: row.confirmedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  private async recordStageChangeIfNeeded(
    fundCode: string,
    trigger: 'buy' | 'sell' | 'rollback_buy' | 'rollback_sell',
  ): Promise<void> {
    try {
      const stageInfo = await this.fundsService.computeLifecycleStage(fundCode);
      if (stageInfo.stageChanged && stageInfo.previousStage) {
        const [fund] = await this.db
          .select()
          .from(schema.funds)
          .where(eq(schema.funds.code, fundCode));
        if (fund) {
          await this.fundsService.recordStageChange(
            fundCode,
            fund.name,
            stageInfo.previousStage,
            stageInfo.lifecycleStage,
            stageInfo.progress,
            trigger,
          );
        }
      }
    } catch {
      // 阶段记录失败不影响主流程
    }
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
