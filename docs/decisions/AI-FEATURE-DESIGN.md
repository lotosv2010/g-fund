# AI 功能设计方案

> 基于 portfolio-monitor skill 规则 + 现有系统架构设计，仅设计不实现。

---

## 1. 功能全景

```
┌─────────────────────────────────────────────────────────────┐
│                      AI 功能体系                             │
├──────────┬──────────┬──────────┬──────────┬────────────────┤
│ 实时监控  │ 止盈止损  │ 定投提醒  │ 数据更新  │ 智能分析       │
│ (MCP/API)│ (预警)   │ (双周四) │ (字段同步)│ (Chat/SSE)    │
└──────────┴──────────┴──────────┴──────────┴────────────────┘
```

| 功能 | 触发方式 | 数据源 | 输出 |
|------|---------|--------|------|
| 每日持仓监控 | Cron 14:00 交易日 | 盈米MCP + 天天基金API | 推送报告 |
| 止盈止损预警 | 每次监控时检查 | 天天基金API（实时） | 预警标记 + 操作建议 |
| 定投执行提醒 | Cron 双周四 14:30 | 盈米MCP + 天天基金API | 定投操作表 |
| 数据字段同步 | Cron 每日 16:30 | 盈米MCP（T+1） | 更新 DB |
| AI 对话分析 | 用户手动触发 | DB + MCP | SSE 流式 |

---

## 2. 架构设计

### 2.1 模块划分

```
apps/api/src/
├── agent/                    # LangGraph Agent（已有 placeholder）
│   ├── graph.ts              # 主图定义
│   ├── llm.factory.ts        # LLM 工厂（deepseek/moonshot/minimax）
│   ├── state.ts              # 状态类型定义
│   └── nodes/
│       ├── data-fetcher.node.ts    # 数据获取节点
│       ├── risk-analyzer.node.ts   # 风险分析节点
│       ├── advisor.node.ts         # 调仓建议节点
│       ├── stop-loss.node.ts       # 🆕 止盈止损检查节点
│       ├── dca-calculator.node.ts  # 🆕 定投金额计算节点
│       └── report-generator.node.ts# 🆕 报告生成节点
├── mcp/                      # 盈米 MCP 客户端（已有 placeholder）
│   └── mcp.service.ts
├── scheduler/                # 🆕 定时任务模块
│   ├── scheduler.module.ts
│   ├── scheduler.service.ts
│   ├── daily-monitor.job.ts      # 每日监控任务
│   ├── dca-reminder.job.ts       # 定投提醒任务
│   └── data-sync.job.ts          # 数据同步任务
├── market-data/              # 🆕 行情数据模块
│   ├── market-data.module.ts
│   ├── market-data.service.ts    # 统一数据源抽象
│   ├── tiantian-api.service.ts   # 天天基金API客户端
│   └── yingmi-adapter.service.ts # 盈米MCP适配器
└── notification/             # 🆕 通知模块
    ├── notification.module.ts
    └── notification.service.ts   # 推送（Web/微信/邮件）
```

### 2.2 数据流

```
                    ┌─────────────┐
                    │  Cron 触发   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │ 每日监控    │ │ 定投提醒    │ │ 数据同步    │
     │ 14:00      │ │ 双周四14:30 │ │ 16:30      │
     └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
           │              │              │
           ▼              ▼              ▼
     ┌─────────────────────────────────────────┐
     │         MarketDataService               │
     │  ┌─────────────┐  ┌─────────────┐      │
     │  │ 天天基金API  │  │  盈米MCP    │      │
     │  │ (盘中实时)   │  │  (T+1)     │      │
     │  └─────────────┘  └─────────────┘      │
     └──────────────────┬──────────────────────┘
                        │
                        ▼
     ┌─────────────────────────────────────────┐
     │         LangGraph Agent                 │
     │  dataFetcher → stopLoss → dcaCalc →     │
     │  riskAnalyzer → advisor → reportGen     │
     └──────────────────┬──────────────────────┘
                        │
           ┌────────────┼────────────┐
           ▼            ▼            ▼
     ┌──────────┐ ┌──────────┐ ┌──────────┐
     │ 更新 DB  │ │ SSE 推送 │ │ 通知推送  │
     └──────────┘ └──────────┘ └──────────┘
```

---

## 3. 功能详细设计

### 3.1 实时行情监控

#### 数据源统一抽象

```typescript
// market-data.service.ts
interface MarketDataProvider {
  /** 获取当日涨跌幅（盘中实时） */
  getDailyReturn(code: string): Promise<number>;

  /** 获取估算净值 */
  getEstimateNav(code: string): Promise<number>;

  /** 获取历史净值 */
  getNavHistory(code: string, days: number): Promise<NavRecord[]>;

  /** 获取估值分位 */
  getValuationPercentile(code: string): Promise<number>;

  /** 获取QDII申购状态 */
  getTradeLimit(code: string): Promise<TradeLimitInfo>;
}

// 双源策略
class MarketDataService {
  // 今日涨跌 → 天天基金API（实时）
  // 历史净值 → 盈米MCP（T+1）
  // 估值分位 → 盈米MCP
  // QDII状态 → 盈米MCP
}
```

#### 天天基金API封装

```typescript
// tiantian-api.service.ts
class TiantianApiService {
  private readonly BASE_URL = 'https://fundgz.1234567.com.cn/js';

  /** 批量获取盘中估值 */
  async batchGetEstimate(codes: string[]): Promise<Map<string, FundEstimate>> {
    // 并发请求，单个失败不中断
    const results = await Promise.allSettled(
      codes.map(code => this.getSingleEstimate(code))
    );
    // ...
  }

  /** 解析 JSONP 响应 */
  private parseJsonp(text: string): FundEstimate {
    const match = text.match(/jsonpgz\((.*)\)/);
    if (!match) throw new Error('Invalid JSONP response');
    const data = JSON.parse(match[1]);
    return {
      code: data.fundcode,
      name: data.name,
      dailyReturn: parseFloat(data.gszzl),
      estimateNav: parseFloat(data.gsz),
      lastNav: parseFloat(data.dwjz),
      updateTime: data.gztime,
    };
  }
}
```

---

### 3.2 止盈止损预警系统

#### 规则引擎

```typescript
// stop-loss.node.ts
interface StopLossCheckResult {
  code: string;
  name: string;
  phase: 'dca' | 'holding';
  profitRate: number;        // 当前盈利率
  signal: '🔴' | '🟡' | '🔵' | '🟢';
  signalType: 'near-take-profit' | 'near-stop-loss' | 'undervalued' | 'normal';
  action: StopLossAction;
  reason: string;
}

interface StopLossAction {
  type: 'hold' | 'take-profit-partial' | 'stop-loss' | 'pause-dca' | 'add-position';
  amount?: number;           // 赎回/补仓金额
  ratio?: number;            // 赎回比例（1/4, 1/3, 1/2）
  triggerPrice?: number;     // 触发价格（观望时给出）
}
```

#### 止盈三档检查（持有期）

```
盈利 ≥ 25% → 赎回 1/4 仓位，回流货币基金
盈利 ≥ 40% → 再赎回 1/3 仓位
盈利 ≥ 60% → 赎回 1/2 仓位，只留底仓
```

#### 止损两档检查（持有期）

```
亏损 ≥ 10% → 暂停该基金定投，观察 1-2 周
亏损 ≥ 20% + 估值>30% → 止损赎回 50%，换仓至低估标的
亏损 ≥ 20% + 估值<30% → 不止损，可加仓（低估区间下跌是机会）
```

#### 深度套牢处理（波段基金，亏损>20%）

```typescript
async function handleDeepLoss(fund: FundPosition): Promise<StopLossAction> {
  const valuation = await marketData.getValuationPercentile(fund.code);

  // Step 1: 检查估值
  if (valuation > 50 || isSectorDeteriorating(fund.sector)) {
    return { type: 'stop-loss', ratio: 0.5, reason: '估值偏高或基本面恶化' };
  }

  // Step 2: 检查反弹迹象（硬性条件）
  const hasRebound = await checkReboundSignal(fund.code);
  if (hasRebound) {
    return { type: 'add-position', amount: calcAddAmount(fund), reason: '满足反弹条件' };
  }

  // Step 3: 观望状态升级
  const watchDays = await getWatchDays(fund.code);
  if (watchDays >= 5) {
    const isDeteriorating = await reassessFundamentals(fund.code);
    if (isDeteriorating) {
      return { type: 'stop-loss', ratio: 0.5, reason: '观望5日+基本面恶化' };
    }
  }

  return { type: 'hold', triggerPrice: calcTriggerPrice(fund), reason: '观望等待信号' };
}

/** 反弹信号检查（硬性规则） */
async function checkReboundSignal(code: string): Promise<boolean> {
  const dailyReturns = await tiantianApi.getRecentDailyReturns(code, 5);

  // 条件①：日涨>1% 连续3个交易日
  const last3 = dailyReturns.slice(-3);
  if (last3.every(r => r > 1)) return true;

  // 条件②：近1周累计涨幅>3%
  const weekReturn = dailyReturns.slice(-5).reduce((sum, r) => sum + r, 0);
  if (weekReturn > 3) return true;

  return false;
}
```

---

### 3.3 定投提醒系统

#### 双周四判断

```typescript
// dca-reminder.job.ts
class DcaReminderJob {
  private readonly FIRST_DCA_DATE = new Date('2026-05-28');

  /** 判断是否为定投日（双周四） */
  isDcaDay(date: Date): boolean {
    if (date.getDay() !== 4) return false; // 必须是周四
    const diff = date.getTime() - this.FIRST_DCA_DATE.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return days % 14 === 0;
  }
}
```

#### 投前三步检查

```typescript
// dca-calculator.node.ts
class DcaCalculatorNode {
  async calculate(state: AnalysisState): Promise<Partial<AnalysisState>> {
    const { holdings, marketData } = state;

    // Step 1: 当日市场检查（P1层）
    const todayReturn = await marketData.getMarketDailyReturn();
    if (todayReturn > 2) {
      return { dcaDecision: { status: 'pause', reason: '大盘涨>2%，全部暂缓' } };
    }

    // Step 2: 近1周趋势检查（P2层）
    const weekReturn = await marketData.getMarketWeekReturn();
    let p2Coeff = 1.0;
    if (weekReturn > 5) p2Coeff = 0.5;
    else if (weekReturn < -5) p2Coeff = 1.3;

    // Step 3: 逐只基金计算（P3+P4层）
    const dcaItems = await Promise.allSettled(
      holdings.map(fund => this.calcSingleFund(fund, p2Coeff))
    );

    return { dcaItems: dcaItems.map(r => r.status === 'fulfilled' ? r.value : null) };
  }

  private async calcSingleFund(fund: Holding, p2Coeff: number): Promise<DcaItem> {
    // P0: QDII申购检查
    if (fund.isQdii) {
      const limit = await mcp.getTradeLimit(fund.code);
      if (!limit.canAllot) {
        return { code: fund.code, amount: 0, reason: 'QDII申购暂停', status: 'paused' };
      }
    }

    // P3: 近1月涨跌系数
    const monthReturn = await marketData.getMonthReturn(fund.code);
    let p3Coeff = 1.0;
    if (monthReturn > 20) p3Coeff = 0;      // 暂停1期
    else if (monthReturn > 10) p3Coeff = 0.5;
    else if (monthReturn < -10) p3Coeff = 1.5;
    else if (monthReturn < -5) p3Coeff = 1.3;

    // P4: 估值叠加系数
    const valuation = await marketData.getValuationPercentile(fund.code);
    let p4Coeff = 1.0;
    if (valuation < 30) p4Coeff = 1.2;
    else if (valuation > 70) p4Coeff = 0.5;

    // T系数（优先级分层）
    const tCoeff = this.getTierCoeff(fund.priority);

    // 叠加计算
    let amount = fund.baseAmount * tCoeff * p2Coeff * p3Coeff * p4Coeff;

    // 上下限检查
    amount = Math.min(amount, fund.baseAmount * 3);  // 上限3倍
    if (amount < fund.baseAmount * 0.1) amount = 0;   // 下限归零

    return {
      code: fund.code,
      amount: Math.round(amount),
      coeffs: { t: tCoeff, p2: p2Coeff, p3: p3Coeff, p4: p4Coeff },
      status: amount > 0 ? 'buy' : 'skip',
    };
  }
}
```

---

### 3.4 数据字段同步

#### 每日 T+1 数据更新

```typescript
// data-sync.job.ts
class DataSyncJob {
  /** 每日 16:30 执行，同步盈米MCP的T+1数据到DB */
  async syncDailyData(): Promise<void> {
    const funds = await this.fundService.findAll();

    // 批量获取净值
    const navData = await this.mcp.batchGetFundsDetail(funds.map(f => f.code));

    // 批量获取历史净值（用于计算收益率）
    const historyData = await this.mcp.batchGetFundNavHistory(
      funds.map(f => f.code),
      'oneMonth'
    );

    // 更新 funds 表
    for (const fund of funds) {
      const nav = navData.get(fund.code);
      const history = historyData.get(fund.code);

      if (nav) {
        await this.fundService.update(fund.id, {
          latestNav: nav.nav.toString(),
          navDate: nav.navDate,
          // 计算并更新收益率字段
          dailyReturn: nav.dailyReturn.toString(),
          weeklyReturn: this.calcReturn(history, 5),
          monthlyReturn: this.calcReturn(history, 20),
        });
      }
    }

    // 生成每日快照
    await this.snapshotService.generate();
  }
}
```

#### 估值分位同步

```typescript
/** 估值分位更新（GetFundDiagnosis 逐只调用，酌情使用） */
async syncValuation(): Promise<void> {
  const indexFunds = await this.fundService.findByCategory('index');

  for (const fund of indexFunds) {
    try {
      const diagnosis = await this.mcp.getFundDiagnosis(fund.code);
      await this.fundService.update(fund.id, {
        valuationPercentile: diagnosis.valuationPercentile.toString(),
      });
    } catch (error) {
      // 单个失败不中断
      this.logger.warn(`Failed to sync valuation for ${fund.code}: ${error.message}`);
    }
  }
}
```

---

### 3.5 智能分析（AI Chat）

#### LangGraph 主图扩展

```typescript
// graph.ts
const graph = new StateGraph(AnalysisState)
  .addNode('dataFetcher', dataFetcherNode)
  .addNode('stopLossChecker', stopLossNode)
  .addNode('dcaCalculator', dcaCalculatorNode)
  .addNode('riskAnalyzer', riskAnalyzerNode)
  .addNode('advisor', advisorNode)
  .addNode('reportGenerator', reportGeneratorNode)
  .addNode('persistResult', persistResultNode)

  // 边定义
  .addEdge('dataFetcher', 'stopLossChecker')
  .addEdge('stopLossChecker', 'dcaCalculator')
  .addEdge('dcaCalculator', 'riskAnalyzer')
  .addEdge('riskAnalyzer', 'advisor')
  .addEdge('advisor', 'reportGenerator')
  .addEdge('reportGenerator', 'persistResult')
  .addEdge('persistResult', END);
```

#### 状态类型

```typescript
// state.ts
interface AnalysisState {
  // 输入
  query: string;
  triggerType: 'manual' | 'cron-daily' | 'cron-dca';

  // 数据层
  holdings: HoldingWithMarketData[];
  swingTrading: SwingFundWithMarketData[];
  sectorWatchlist: SectorData[];
  marketOverview: MarketOverview;

  // 分析结果
  stopLossResults: StopLossCheckResult[];
  dcaDecision: DcaDecision;
  dcaItems: DcaItem[];
  riskReport: RiskReport;
  recommendations: Recommendation[];

  // 输出
  report: string;  // Markdown 格式报告
}
```

---

### 3.6 报告生成

#### 每日监控报告（模板A）

```typescript
// report-generator.node.ts
function generateDailyReport(state: AnalysisState): string {
  const { holdings, swingTrading, sectorWatchlist, stopLossResults } = state;

  return `
## 持仓日报 ${formatDate(new Date())}

### 止盈止损速览
${generateStopLossSummary(stopLossResults)}

### 持仓操作建议
${generateHoldingsTable(holdings, stopLossResults)}

### 波段基金操作建议
${generateSwingTable(swingTrading)}

### 行业板块监控
${generateSectorTable(sectorWatchlist)}

### 风险提示
${generateRiskWarnings(state)}
`;
}
```

#### 定投执行报告（模板B）

```typescript
function generateDcaReport(state: AnalysisState): string {
  const { dcaDecision, dcaItems, sectorWatchlist } = state;

  return `
## 定投执行报告 ${formatDate(new Date())}

### 市场条件检查
- 大盘今日：${state.marketOverview.dailyReturn}%
- 近1周：${state.marketOverview.weekReturn}%
- 执行结论：${dcaDecision.status === 'pause' ? '暂停' : '正常执行'}

### 定投操作表
${generateDcaTable(dcaItems)}

### 行业板块监控
${generateSectorTable(sectorWatchlist)}

### 注意事项
${generateDcaWarnings(state)}
`;
}
```

---

## 4. 定时任务调度

### 4.1 Cron 配置

```typescript
// scheduler.service.ts
@Injectable()
class SchedulerService {
  /** 每日监控：交易日 14:00 */
  @Cron('0 14 * * 1-5')
  async dailyMonitor() {
    if (!isTradeDay()) return;
    await this.graph.invoke({ triggerType: 'cron-daily' });
  }

  /** 定投提醒：每周四 14:30（脚本内判断双周） */
  @Cron('30 14 * * 4')
  async dcaReminder() {
    if (!this.dcaJob.isDcaDay(new Date())) return;
    await this.graph.invoke({ triggerType: 'cron-dca' });
  }

  /** 数据同步：交易日 16:30（T+1数据就绪） */
  @Cron('30 16 * * 1-5')
  async dataSync() {
    if (!isTradeDay()) return;
    await this.dataSyncJob.syncDailyData();
  }

  /** 估值分位同步：交易日 17:00（低频，逐只调用） */
  @Cron('0 17 * * 1-5')
  async valuationSync() {
    if (!isTradeDay()) return;
    await this.dataSyncJob.syncValuation();
  }
}
```

### 4.2 交易日判断

```typescript
// utils/trade-day.ts
function isTradeDay(date: Date = new Date()): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // 周末
  // TODO: 接入节假日API或维护节假日表
  return !isHoliday(date);
}
```

---

## 5. 数据库扩展

### 5.1 新增表

```sql
-- 止盈止损记录表
CREATE TABLE stop_loss_records (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER REFERENCES funds(id),
  signal_type VARCHAR(20) NOT NULL,  -- near-take-profit / near-stop-loss / triggered
  profit_rate NUMERIC(10, 4),
  action_type VARCHAR(20),           -- hold / take-profit / stop-loss / pause
  action_amount NUMERIC(15, 2),
  action_ratio NUMERIC(5, 4),
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 定投执行记录表
CREATE TABLE dca_records (
  id SERIAL PRIMARY KEY,
  execute_date DATE NOT NULL,
  market_daily_return NUMERIC(10, 4),
  market_week_return NUMERIC(10, 4),
  decision VARCHAR(20) NOT NULL,     -- execute / pause / reduce
  total_amount NUMERIC(15, 2),
  details JSONB,                     -- 每只基金的计算明细
  created_at TIMESTAMP DEFAULT NOW()
);

-- 预警配置表（替代 config 硬编码）
CREATE TABLE alert_configs (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER REFERENCES funds(id),
  alert_type VARCHAR(20) NOT NULL,   -- take-profit / stop-loss / valuation
  threshold NUMERIC(10, 4) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 5.2 扩展 funds 表

```sql
ALTER TABLE funds ADD COLUMN valuation_percentile NUMERIC(5, 2);
ALTER TABLE funds ADD COLUMN weekly_return NUMERIC(10, 4);
ALTER TABLE funds ADD COLUMN monthly_return NUMERIC(10, 4);
ALTER TABLE funds ADD COLUMN phase VARCHAR(20) DEFAULT 'dca';  -- dca / holding
ALTER TABLE funds ADD COLUMN priority VARCHAR(5);              -- T1/T2/T3/T4
ALTER TABLE funds ADD COLUMN target_amount NUMERIC(15, 2);
ALTER TABLE funds ADD COLUMN base_amount NUMERIC(15, 2);       -- 定投基准金额
```

---

## 6. API 接口扩展

### 6.1 新增端点

```typescript
// analysis.controller.ts
@Controller('analysis')
class AnalysisController {
  /** SSE 流式分析（已有设计） */
  @Sse('stream')
  streamAnalysis(@Query('query') query: string): Observable<MessageEvent>;

  /** 手动触发每日监控报告 */
  @Post('daily-report')
  generateDailyReport(): Promise<AnalysisRecord>;

  /** 手动触发定投计算 */
  @Post('dca-calculate')
  calculateDca(): Promise<DcaRecord>;

  /** 获取止盈止损状态 */
  @Get('stop-loss-status')
  getStopLossStatus(): Promise<StopLossCheckResult[]>;

  /** 获取定投建议 */
  @Get('dca-suggestion')
  getDcaSuggestion(): Promise<DcaItem[]>;
}

// scheduler.controller.ts
@Controller('scheduler')
class SchedulerController {
  /** 获取定时任务状态 */
  @Get('status')
  getStatus(): Promise<SchedulerStatus>;

  /** 手动触发任务（调试用） */
  @Post('trigger/:jobName')
  triggerJob(@Param('jobName') jobName: string): Promise<void>;
}
```

---

## 7. 前端交互设计

### 7.1 Dashboard 增强

```
┌─────────────────────────────────────────────────────┐
│ Dashboard                                            │
├─────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│ │ 总资产   │ │ 今日盈亏 │ │ 持仓收益 │ │ 定投进度 │   │
│ │ ¥XX,XXX │ │ +¥XXX   │ │ +X.XX%  │ │ 68%     │   │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│                                                      │
│ ┌──────────────────────┐ ┌──────────────────────┐  │
│ │ 止盈止损速览          │ │ 下次定投              │  │
│ │ 🔴 创业板ETF +25.3%  │ │ 2026-06-25 (周四)    │  │
│ │ 🟡 白酒 -8.2%        │ │ 预估金额：¥X,XXX     │  │
│ │ 🟢 其余正常          │ │ [查看详细建议]        │  │
│ └──────────────────────┘ └──────────────────────┘  │
│                                                      │
│ ┌──────────────────────────────────────────────┐   │
│ │ 最近预警                                      │   │
│ │ 2026-06-08 🔴 创业板ETF 接近止盈（+25.3%）    │   │
│ │ 2026-06-07 🟡 白酒 接近止损（-8.2%）          │   │
│ └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 7.2 AI 抽屉增强

```typescript
// 新增快捷指令
const AI_COMMANDS = [
  { label: '今日监控', trigger: 'cron-daily', description: '生成每日持仓报告' },
  { label: '定投计算', trigger: 'cron-dca', description: '计算定投金额' },
  { label: '止盈止损', trigger: 'stop-loss', description: '检查止盈止损状态' },
  { label: '板块分析', trigger: 'sector', description: '行业板块趋势分析' },
  { label: '基金诊断', trigger: 'diagnosis', description: '单只基金深度分析' },
];
```

---

## 8. 实现优先级

### Phase 1：基础设施（1周）

| 任务 | 依赖 | 产出 |
|------|------|------|
| McpService 实现 | 盈米MCP连接 | 可调用所有MCP工具 |
| TiantianApiService 实现 | 无 | 可获取盘中估值 |
| MarketDataService 抽象 | 上述两个Service | 统一数据源接口 |
| @nestjs/schedule 集成 | 无 | Cron调度能力 |

### Phase 2：核心分析（1周）

| 任务 | 依赖 | 产出 |
|------|------|------|
| dataFetcher 节点 | MarketDataService | 数据获取能力 |
| stopLoss 节点 | dataFetcher | 止盈止损检查 |
| dcaCalculator 节点 | dataFetcher | 定投金额计算 |
| LangGraph 主图 | 所有节点 | 完整分析流程 |

### Phase 3：定时任务（3天）

| 任务 | 依赖 | 产出 |
|------|------|------|
| 每日监控 Job | LangGraph主图 | 自动推送报告 |
| 定投提醒 Job | LangGraph主图 | 双周四自动提醒 |
| 数据同步 Job | McpService | T+1数据自动入库 |

### Phase 4：前端集成（1周）

| 任务 | 依赖 | 产出 |
|------|------|------|
| Dashboard 预警卡片 | API | 止盈止损可视化 |
| AI 抽屉快捷指令 | API | 一键触发分析 |
| 报告展示组件 | API | Markdown渲染 |

---

## 9. 配置项

```env
# LLM
LLM_PROVIDER=deepseek          # deepseek / moonshot / minimax
DEEPSEEK_API_KEY=sk-xxx
MOONSHOT_API_KEY=sk-xxx
MINIMAX_API_KEY=xxx

# MCP
QIEMAN_MCP_URL=http://mcp.qieman.com/sse

# 天天基金API
TIANTIAN_API_TIMEOUT=5000      # 请求超时（ms）

# 定时任务
SCHEDULER_ENABLED=true
DCA_FIRST_DATE=2026-05-28      # 首个定投日

# 通知
NOTIFICATION_CHANNEL=web       # web / wechat / email
```
