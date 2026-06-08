"use client";
import { useState, useEffect, useCallback } from "react";
import { Col, Row, Typography, message } from "antd";
import type { PositionListItem, Transaction } from "@g-fund/types";
import { positionsApi, transactionsApi } from "@/lib/api-client";
import StatCards from "@/components/StatCards";
import PnLChart from "@/components/PnLChart";
import PositionPie from "@/components/PositionPie";
import RecentTrades from "@/components/RecentTrades";

const { Title } = Typography;

export default function DashboardPage() {
  const [positions, setPositions] = useState<PositionListItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [posLoading, setPosLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
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

  useEffect(() => {
    loadPositions();
    loadTransactions();
  }, [loadPositions, loadTransactions]);

  return (
    <>
      {contextHolder}
      <Title level={4} style={{ marginBottom: 16 }}>总览</Title>
      <StatCards data={positions} loading={posLoading} />
      <Row gutter={[16, 16]} style={{ marginTop: 16 }} align="stretch">
        <Col xs={24} lg={14}>
          <PnLChart />
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
