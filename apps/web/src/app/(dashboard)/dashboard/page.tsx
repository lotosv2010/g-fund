"use client";
import { useState, useEffect, useCallback } from "react";
import { Col, Row, Typography, message } from "antd";
import type { PositionListItem, Transaction, DailySnapshot } from "@g-fund/types";
import { positionsApi, transactionsApi, dailySnapshotsApi } from "@/lib/api-client";
import StatCards from "@/components/StatCards";
import PnLChart from "@/components/PnLChart";
import PositionPie from "@/components/PositionPie";
import RecentTrades from "@/components/RecentTrades";

const { Title } = Typography;

export default function DashboardPage() {
  const [positions, setPositions] = useState<PositionListItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [posLoading, setPosLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [snapLoading, setSnapLoading] = useState(false);
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

  useEffect(() => {
    loadPositions();
    loadTransactions();
    loadSnapshots();
  }, [loadPositions, loadTransactions, loadSnapshots]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySnapshot = snapshots.find((s) => s.snapshotDate === todayStr) ?? null;

  return (
    <>
      {contextHolder}
      <Title level={4} style={{ marginBottom: 16 }}>总览</Title>
      <StatCards data={positions} loading={posLoading} todaySnapshot={todaySnapshot} />
      <Row gutter={[16, 16]} style={{ marginTop: 16 }} align="stretch">
        <Col xs={24} lg={14}>
          <PnLChart data={snapshots} loading={snapLoading} />
        </Col>
        <Col xs={24} lg={10}>
          <PositionPie data={positions} loading={posLoading} />
        </Col>
      </Row>
      <div style={{ marginTop: 16 }}>
        <RecentTrades data={transactions} loading={txLoading} />
      </div>
    </>
  );
}
