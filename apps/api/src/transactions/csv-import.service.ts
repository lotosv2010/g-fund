import { Injectable, BadRequestException } from '@nestjs/common';
import * as Papa from 'papaparse';
import { ImportTransactionRow, ImportError } from '@g-fund/types';

interface CsvRow {
  [key: string]: string;
}

interface ColumnMapping {
  fundCode: string[];
  type: string[];
  amount: string[];
  shares: string[];
  price: string[];
  tradeDate: string[];
  note: string[];
}

const COLUMN_MAPPINGS: Record<string, ColumnMapping> = {
  alipay: {
    fundCode: ['基金代码', '基金编码', '代码'],
    type: ['交易类型', '类型', '操作'],
    amount: ['金额', '交易金额', '确认金额'],
    shares: ['份额', '确认份额', '持有份额'],
    price: ['净值', '单位净值', '成交净值'],
    tradeDate: ['交易日期', '确认日期', '日期', '成交日期'],
    note: ['备注', '说明', '摘要'],
  },
  tiantian: {
    fundCode: ['基金代码', '基金编码', '代码'],
    type: ['交易类型', '类型', '业务类型'],
    amount: ['金额', '交易金额', '确认金额'],
    shares: ['份额', '确认份额'],
    price: ['净值', '单位净值'],
    tradeDate: ['交易日期', '确认日期', '日期'],
    note: ['备注', '说明'],
  },
  danjuan: {
    fundCode: ['基金代码', '代码'],
    type: ['交易类型', '类型'],
    amount: ['金额', '交易金额'],
    shares: ['份额', '确认份额'],
    price: ['净值', '单位净值'],
    tradeDate: ['交易日期', '日期'],
    note: ['备注'],
  },
  generic: {
    fundCode: ['fundCode', 'fund_code', 'code', '基金代码', '代码'],
    type: ['type', '交易类型', '类型'],
    amount: ['amount', '金额', '交易金额'],
    shares: ['shares', '份额', '持有份额'],
    price: ['price', 'price', '净值', '单位净值'],
    tradeDate: ['tradeDate', 'trade_date', 'date', '交易日期', '日期'],
    note: ['note', '备注', '说明'],
  },
};

@Injectable()
export class CsvImportService {
  parseCsv(content: string, format: string = 'auto'): ImportTransactionRow[] {
    const result = Papa.parse<CsvRow>(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
    });

    if (result.errors.length > 0) {
      throw new BadRequestException(`CSV 解析错误: ${result.errors[0].message}`);
    }

    const rows = result.data;
    if (rows.length === 0) {
      throw new BadRequestException('CSV 文件为空');
    }

    const detectedFormat = format === 'auto' ? this.detectFormat(rows[0]) : format;
    const mapping = COLUMN_MAPPINGS[detectedFormat] || COLUMN_MAPPINGS.generic;

    return this.mapRows(rows, mapping);
  }

  private detectFormat(firstRow: CsvRow): string {
    const headers = Object.keys(firstRow);

    for (const [format, mapping] of Object.entries(COLUMN_MAPPINGS)) {
      const allColumns = [
        ...mapping.fundCode,
        ...mapping.type,
        ...mapping.amount,
        ...mapping.tradeDate,
      ];

      const matchCount = headers.filter((h) => allColumns.includes(h)).length;
      if (matchCount >= 3) {
        return format;
      }
    }

    return 'generic';
  }

  private mapRows(rows: CsvRow[], mapping: ColumnMapping): ImportTransactionRow[] {
    const errors: ImportError[] = [];
    const result: ImportTransactionRow[] = [];

    rows.forEach((row, index) => {
      const rowNum = index + 2; // +2 because header is row 1, data starts at row 2

      try {
        const fundCode = this.findColumnValue(row, mapping.fundCode);
        const typeStr = this.findColumnValue(row, mapping.type);
        const amountStr = this.findColumnValue(row, mapping.amount);
        const tradeDateStr = this.findColumnValue(row, mapping.tradeDate);

        if (!fundCode) {
          errors.push({ row: rowNum, field: 'fundCode', message: '基金代码不能为空' });
          return;
        }

        if (!typeStr) {
          errors.push({ row: rowNum, field: 'type', message: '交易类型不能为空' });
          return;
        }

        if (!amountStr) {
          errors.push({ row: rowNum, field: 'amount', message: '金额不能为空' });
          return;
        }

        if (!tradeDateStr) {
          errors.push({ row: rowNum, field: 'tradeDate', message: '交易日期不能为空' });
          return;
        }

        const type = this.parseType(typeStr);
        if (!type) {
          errors.push({ row: rowNum, field: 'type', message: `无法识别的交易类型: ${typeStr}` });
          return;
        }

        const amount = this.parseNumber(amountStr);
        if (isNaN(amount) || amount <= 0) {
          errors.push({ row: rowNum, field: 'amount', message: `金额格式错误: ${amountStr}` });
          return;
        }

        const tradeDate = this.parseDate(tradeDateStr);
        if (!tradeDate) {
          errors.push({ row: rowNum, field: 'tradeDate', message: `日期格式错误: ${tradeDateStr}` });
          return;
        }

        const sharesStr = this.findColumnValue(row, mapping.shares);
        const priceStr = this.findColumnValue(row, mapping.price);
        const noteStr = this.findColumnValue(row, mapping.note);

        result.push({
          fundCode: fundCode.trim(),
          type,
          amount,
          shares: sharesStr ? this.parseNumber(sharesStr) : undefined,
          price: priceStr ? this.parseNumber(priceStr) : undefined,
          tradeDate,
          note: noteStr?.trim() || undefined,
        });
      } catch (err) {
        errors.push({
          row: rowNum,
          field: 'unknown',
          message: err instanceof Error ? err.message : '未知错误',
        });
      }
    });

    if (errors.length > 0 && result.length === 0) {
      throw new BadRequestException({
        message: '所有行解析失败',
        errors,
      });
    }

    return result;
  }

  private findColumnValue(row: CsvRow, columnNames: string[]): string | undefined {
    for (const name of columnNames) {
      if (row[name] !== undefined && row[name] !== '') {
        return row[name];
      }
    }
    return undefined;
  }

  private parseType(typeStr: string): 'buy' | 'sell' | null {
    const normalized = typeStr.toLowerCase().trim();

    const buyKeywords = ['买', '申购', '买入', '定投', 'buy', 'purchase', 'invest'];
    const sellKeywords = ['卖', '赎回', '卖出', 'sell', 'redeem'];

    if (buyKeywords.some((k) => normalized.includes(k))) {
      return 'buy';
    }
    if (sellKeywords.some((k) => normalized.includes(k))) {
      return 'sell';
    }

    return null;
  }

  private parseNumber(str: string): number {
    const cleaned = str.replace(/[,\s¥￥]/g, '');
    return parseFloat(cleaned);
  }

  private parseDate(str: string): string | null {
    // Try YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try YYYY/MM/DD
    const slashMatch = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (slashMatch) {
      const [, year, month, day] = slashMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try YYYYMMDD
    const compactMatch = str.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compactMatch) {
      const [, year, month, day] = compactMatch;
      return `${year}-${month}-${day}`;
    }

    // Try DD/MM/YYYY
    const euMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (euMatch) {
      const [, day, month, year] = euMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return null;
  }
}
