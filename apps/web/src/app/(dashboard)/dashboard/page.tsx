"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Col, Row, Space, Typography, message } from "antd";
import type { PositionListItem, Transaction, DailySnapshot, StopLossTakeProfitSignal, SlpSignalLog, DcaCalculation, DcaSnapshot, AssetAllocationResponse, FundListItem } from "@g-fund/types";
import { positionsApi, transactionsApi, dailySnapshotsApi, stopLossTakeProfitApi, dcaApi, dashboardApi, fundsApi } from "@/lib/api-client";
import StatCards from "@/components/StatCards";
import PnLChart from "@/components/PnLChart";
import AssetAllocationCard from "@/components/AssetAllocationCard";
import RecentTrades from "@/components/RecentTrades";
import SyncPositionsButton from "@/components/SyncPositionsButton";
import StopLossTakeProfitCard from "@/components/StopLossTakeProfitCard";
import DcaEstimateCard from "@/components/DcaEstimateCard";
import AlertTimeline from "@/components/AlertTimeline";
import StageProgressCard from "@/components/StageProgressCard";
import TotalProfitDrawer from "@/components/TotalProfitDrawer";
import FundProfitDrawer from "@/components/FundProfitDrawer";
import MarketIndexBoard from "@/components/MarketIndexBoard";

const { Title } = Typography;

export default function DashboardPage() {
  const router = useRouter();
  const [positions, setPositions] = useState<PositionListItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [signals, setSignals] = useState<StopLossTakeProfitSignal[]>([]);
  const [signalHistory, setSignalHistory] = useState<SlpSignalLog[]>([]);
  const [dcaData, setDcaData] = useState<DcaCalculation[]>([]);
  const [dcaSnapshots, setDcaSnapshots] = useState<DcaSnapshot[]>([]);
  const [nextDcaDate, setNextDcaDate] = useState<string | null>(null);
  const [assetAllocation, setAssetAllocation] = useState<AssetAllocationResponse | null>(null);
  const [funds, setFunds] = useState<FundListItem[]>([]);
  const [posLoading, setPosLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [snapLoading, setSnapLoading] = useState(false);
  const [signalLoading, setSignalLoading] = useState(false);
  const [dcaLoading, setDcaLoading] = useState(false);
  const [allocLoading, setAllocLoading] = useState(false);
  const [fundsLoading, setFundsLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const [totalProfitOpen, setTotalProfitOpen] = useState(false);
  const [fundProfitOpen, setFundProfitOpen] = useState(false);
  const [fundProfitCode, setFundProfitCode] = useState<string>("");
  const [fundProfitName, setFundProfitName] = useState<string>("");

  const loadPositions = useCallback(async () => {
    setPosLoading(true);
    try {
      const data = await positionsApi.list();
      setPositions(data);
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setPosLoading(false);
    }
  }, [messageApi]);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const data = await transactionsApi.list();
      setTransactions(data);
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setTxLoading(false);
    }
  }, [messageApi]);

  const loadSnapshots = useCallback(async () => {
    setSnapLoading(true);
    try {
      let data = await dailySnapshotsApi.list();
      if (data.length === 0) {
        await dailySnapshotsApi.generate().catch(() => {});
        data = await dailySnapshotsApi.list();
      }
      setSnapshots(data);
    } catch {
      // snapshots may not exist yet, silent
    } finally {
      setSnapLoading(false);
    }
  }, []);

  const loadSignals = useCallback(async () => {
    setSignalLoading(true);
    try {
      const [signalsData, historyData] = await Promise.all([
        stopLossTakeProfitApi.list(),
        stopLossTakeProfitApi.history({ days: 30 }),
      ]);
      setSignals(signalsData);
      setSignalHistory(historyData);
    } catch {
      // may not have data yet
    } finally {
      setSignalLoading(false);
    }
  }, []);

  const loadDca = useCallback(async () => {
    setDcaLoading(true);
    try {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const [dcaData, snapshotsData, nextDateData] = await Promise.all([
        dcaApi.calculate(),
        dcaApi.getSnapshots(today).catch(() => []),
        dcaApi.getNextDate().catch(() => null),
      ]);
      setDcaData(dcaData);
      setDcaSnapshots(snapshotsData);
      setNextDcaDate(nextDateData?.nextDate ?? null);
    } catch {
      // may not have data yet
    } finally {
      setDcaLoading(false);
    }
  }, []);

  const loadAssetAllocation = useCallback(async () => {
    setAllocLoading(true);
    try {
      const data = await dashboardApi.assetAllocation();
      setAssetAllocation(data);
    } catch {
      // may not have data yet
    } finally {
      setAllocLoading(false);
    }
  }, []);

  const loadFunds = useCallback(async () => {
    setFundsLoading(true);
    try {
      const data = await fundsApi.list();
      setFunds(data);
    } catch {
      // may not have data yet
    } finally {
      setFundsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPositions();
    loadTransactions();
    loadSnapshots();
    loadSignals();
    loadDca();
    loadAssetAllocation();
    loadFunds();
  }, [loadPositions, loadTransactions, loadSnapshots, loadSignals, loadDca, loadAssetAllocation, loadFunds]);

  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const yesterdayStr = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const dayBeforeYesterdayStr = (() => { const d = new Date(); d.setDate(d.getDate() - 2); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const todaySnapshot = snapshots.find((s) => s.snapshotDate === todayStr) ?? null;
  const yesterdaySnapshot = snapshots.find((s) => s.snapshotDate === yesterdayStr) ?? null;
  const dayBeforeYesterdaySnapshot = snapshots.find((s) => s.snapshotDate === dayBeforeYesterdayStr) ?? null;

  function handleTotalAssetsClick() {
    router.push("/positions");
  }

  function handleTotalViewFundDetail(fundCode: string, fundName: string) {
    setTotalProfitOpen(false);
    setFundProfitCode(fundCode);
    setFundProfitName(fundName);
    setFundProfitOpen(true);
  }

  return (
    <>
      {contextHolder}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>总览</Title>
        <Space>
          <SyncPositionsButton onDone={() => loadPositions()} />
        </Space>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }} align="stretch">
        <Col xs={24}>
          <MarketIndexBoard />
        </Col>
      </Row>
      <div style={{ marginTop: 16 }}>
        <StatCards
          data={positions}
          loading={posLoading}
          todaySnapshot={todaySnapshot}
          yesterdaySnapshot={yesterdaySnapshot}
          dayBeforeYesterdaySnapshot={dayBeforeYesterdaySnapshot}
          onTotalAssetsClick={handleTotalAssetsClick}
          onTotalPnlClick={() => setTotalProfitOpen(true)}
        />
      </div>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }} align="stretch">
        <Col xs={24} lg={8}>
          <StageProgressCard data={funds} loading={fundsLoading} />
        </Col>
        <Col xs={24} lg={16}>
          <AssetAllocationCard data={assetAllocation} loading={allocLoading} />
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }} align="stretch">
        <Col xs={24}>
          <PnLChart data={snapshots} loading={snapLoading} />
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }} align="stretch">
        <Col xs={24} lg={8}>
          <StopLossTakeProfitCard data={signals} loading={signalLoading} />
        </Col>
        <Col xs={24} lg={8}>
          <DcaEstimateCard
            data={dcaData}
            loading={dcaLoading}
            snapshots={dcaSnapshots}
            onSnapshotUpdate={loadDca}
            nextDcaDate={nextDcaDate}
          />
        </Col>
        <Col xs={24} lg={8}>
          <AlertTimeline data={signalHistory} loading={signalLoading} />
        </Col>
      </Row>
      <div style={{ marginTop: 16 }}>
        <RecentTrades data={transactions} loading={txLoading} />
      </div>

      <TotalProfitDrawer
        open={totalProfitOpen}
        onClose={() => setTotalProfitOpen(false)}
        data={positions}
        onViewFundDetail={handleTotalViewFundDetail}
      />

      <FundProfitDrawer
        fundCode={fundProfitCode || null}
        fundName={fundProfitName}
        open={fundProfitOpen}
        onClose={() => setFundProfitOpen(false)}
      />
    </>
  );
}
