"use client";
import { useState, useEffect, useCallback } from "react";
import { Col, Row, Space, Typography, message } from "antd";
import type { PositionListItem, Transaction, DailySnapshot, StopLossTakeProfitSignal, DcaCalculation } from "@g-fund/types";
import { positionsApi, transactionsApi, dailySnapshotsApi, stopLossTakeProfitApi, dcaApi } from "@/lib/api-client";
import StatCards from "@/components/StatCards";
import PnLChart from "@/components/PnLChart";
import PositionPie from "@/components/PositionPie";
import RecentTrades from "@/components/RecentTrades";
import SyncPositionsButton from "@/components/SyncPositionsButton";
import StopLossTakeProfitCard from "@/components/StopLossTakeProfitCard";
import DcaEstimateCard from "@/components/DcaEstimateCard";
import AlertTimeline from "@/components/AlertTimeline";

const { Title } = Typography;

export default function DashboardPage() {
  const [positions, setPositions] = useState<PositionListItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [signals, setSignals] = useState<StopLossTakeProfitSignal[]>([]);
  const [dcaData, setDcaData] = useState<DcaCalculation[]>([]);
  const [posLoading, setPosLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [snapLoading, setSnapLoading] = useState(false);
  const [signalLoading, setSignalLoading] = useState(false);
  const [dcaLoading, setDcaLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

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
      const data = await dailySnapshotsApi.list();
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
      const data = await stopLossTakeProfitApi.list();
      setSignals(data);
    } catch {
      // may not have data yet
    } finally {
      setSignalLoading(false);
    }
  }, []);

  const loadDca = useCallback(async () => {
    setDcaLoading(true);
    try {
      const data = await dcaApi.calculate();
      setDcaData(data);
    } catch {
      // may not have data yet
    } finally {
      setDcaLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPositions();
    loadTransactions();
    loadSnapshots();
    loadSignals();
    loadDca();
  }, [loadPositions, loadTransactions, loadSnapshots, loadSignals, loadDca]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySnapshot = snapshots.find((s) => s.snapshotDate === todayStr) ?? null;

  return (
    <>
      {contextHolder}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>总览</Title>
        <Space>
          <SyncPositionsButton onDone={() => loadPositions()} />
        </Space>
      </Row>
      <StatCards data={positions} loading={posLoading} todaySnapshot={todaySnapshot} />
      <Row gutter={[16, 16]} style={{ marginTop: 16 }} align="stretch">
        <Col xs={24} lg={14}>
          <PnLChart data={snapshots} loading={snapLoading} />
        </Col>
        <Col xs={24} lg={10}>
          <PositionPie data={positions} loading={posLoading} />
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }} align="stretch">
        <Col xs={24} lg={8}>
          <StopLossTakeProfitCard data={signals} loading={signalLoading} />
        </Col>
        <Col xs={24} lg={8}>
          <DcaEstimateCard data={dcaData} loading={dcaLoading} />
        </Col>
        <Col xs={24} lg={8}>
          <AlertTimeline data={signals} loading={signalLoading} />
        </Col>
      </Row>
      <div style={{ marginTop: 16 }}>
        <RecentTrades data={transactions} loading={txLoading} />
      </div>
    </>
  );
}
