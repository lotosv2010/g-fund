"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button, Input, Space, Typography, message, Tabs, Flex, Tooltip } from "antd";
import { PlusOutlined, SyncOutlined } from "@ant-design/icons";
import type { SorterResult } from "antd/es/table/interface";
import type { FundListItem, CreateFundDto, UpdateFundDto, FundCategory, StopLossTakeProfitSignal } from "@g-fund/types";
import { FUND_CATEGORIES, FUND_CATEGORY_LABELS } from "@g-fund/types";
import { fundsApi, stopLossTakeProfitApi } from "@/lib/api-client";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { FundsTable } from "./components/funds-table";
import { FundFormModal } from "./components/fund-form-modal";

const { Title } = Typography;

export default function FundsPage() {
  const [funds, setFunds] = useState<FundListItem[]>([]);
  const [signals, setSignals] = useState<StopLossTakeProfitSignal[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<FundCategory>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"ascend" | "descend" | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFund, setEditingFund] = useState<FundListItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [syncingInfo, setSyncingInfo] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fundsData, signalsData] = await Promise.all([
        fundsApi.list(),
        stopLossTakeProfitApi.list().catch(() => []),
      ]);
      setFunds(fundsData);
      setSignals(signalsData);
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => { load(); }, [load]);

  const isCustomSort = sortField !== null && sortOrder !== null;

  const categoryFunds = useMemo(() => {
    let list = activeTab === "all"
      ? funds
      : funds.filter((f) => f.category === activeTab);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.name.toLowerCase().includes(q) || f.code.includes(q));
    }

    if (isCustomSort && sortField) {
      const dir = sortOrder === "ascend" ? 1 : -1;
      list = [...list].sort((a, b) => {
        const va = a[sortField as keyof FundListItem];
        const vb = b[sortField as keyof FundListItem];
        if (typeof va === "string" && typeof vb === "string") {
          return dir * va.localeCompare(vb);
        }
        return dir * (Number(va) - Number(vb));
      });
    }

    return list;
  }, [funds, activeTab, search, sortField, sortOrder, isCustomSort]);

  const categoryCounts = useMemo(() => {
    const counts: Record<FundCategory, number> = { all: 0, longterm: 0, watchlist: 0 };
    for (const f of funds) {
      if (search && !f.name.toLowerCase().includes(search.toLowerCase()) && !f.code.includes(search)) continue;
      counts.all++;
      if (f.category === "longterm") counts.longterm++;
      if (f.category === "watchlist") counts.watchlist++;
    }
    return counts;
  }, [funds, search]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categoryFunds.findIndex((f) => f.code === active.id);
    const newIndex = categoryFunds.findIndex((f) => f.code === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(categoryFunds, oldIndex, newIndex);
    const updated = funds.map((f) => {
      const idx = reordered.findIndex((r) => r.code === f.code);
      return idx !== -1 ? { ...f, sortOrder: idx } : f;
    });
    setFunds(updated);

    try {
      await fundsApi.reorder(reordered.map((f, i) => ({ code: f.code, sortOrder: i })));
      messageApi.success("排序已更新");
      load();
    } catch (e) {
      messageApi.error((e as Error).message);
      load();
    }
  }

  async function handleCreate(values: CreateFundDto & { category: FundCategory }) {
    setSubmitting(true);
    try {
      await fundsApi.create({
        ...values,
        category: values.category ?? activeTab,
        targetRatio: values.targetRatio ? String(values.targetRatio) : undefined,
      });
      messageApi.success("添加成功");
      setModalOpen(false);
      setEditingFund(null);
      load();
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(values: CreateFundDto & { category: FundCategory }) {
    if (!editingFund) return;
    setSubmitting(true);
    try {
      const dto: UpdateFundDto = {
        name: values.name,
        type: values.type,
        riskLevel: values.riskLevel,
        category: values.category,
        targetRatio: values.targetRatio !== undefined ? String(values.targetRatio) : undefined,
        note: values.note,
      };
      await fundsApi.update(editingFund.code, dto);
      messageApi.success("更新成功");
      setModalOpen(false);
      setEditingFund(null);
      load();
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(code: string) {
    try {
      await fundsApi.remove(code);
      messageApi.success("删除成功");
      load();
    } catch (e) {
      messageApi.error((e as Error).message);
    }
  }

  function handleTableChange(
    _pagination: unknown,
    _filters: unknown,
    sorter: SorterResult<FundListItem> | SorterResult<FundListItem>[],
  ) {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    if (s.field && s.order) {
      setSortField(s.field as string);
      setSortOrder(s.order);
    } else {
      setSortField(null);
      setSortOrder(null);
    }
  }

  async function handleSyncInfo() {
    setSyncingInfo(true);
    try {
      const result = await fundsApi.syncInfo();
      const valMsg = result.valuations
        ? `，估值 ${result.valuations.updated}/${result.valuations.total} 已刷新`
        : "";
      messageApi.success(`同步完成：${result.updated} 更新 / ${result.skipped} 跳过 / ${result.failed} 失败${valMsg}`);
      load();
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setSyncingInfo(false);
    }
  }

  const tabItems = FUND_CATEGORIES.map((cat) => ({
    key: cat,
    label: `${FUND_CATEGORY_LABELS[cat]}（${categoryCounts[cat]}）`,
    children: (
      <FundsTable
        dataSource={categoryFunds}
        loading={loading}
        isCustomSort={isCustomSort}
        signals={signals}
        onDragEnd={handleDragEnd}
        onEdit={(record) => setEditingFund(record)}
        onDelete={handleDelete}
        onTableChange={handleTableChange}
      />
    ),
  }));

  return (
    <>
      {contextHolder}
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
        <Flex justify="space-between" align="center">
          <Title level={4} style={{ margin: 0 }}>基金列表</Title>
        </Flex>

        <Flex justify="space-between" align="center">
          <Input.Search
            value={search}
            placeholder="搜索基金名称或代码"
            allowClear
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
            style={{ maxWidth: 320 }}
          />
          <Space>
            <Tooltip title="从外部数据源同步所有基金的名称、类型、风险等级，并刷新估值百分位">
              <Button
                icon={<SyncOutlined spin={syncingInfo} />}
                onClick={handleSyncInfo}
                loading={syncingInfo}
              >
                同步基金信息
              </Button>
            </Tooltip>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalOpen(true)}
            >
              添加基金
            </Button>
          </Space>
        </Flex>

        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key as FundCategory);
            setSortField(null);
            setSortOrder(null);
          }}
          items={tabItems}
        />
      </Space>

      <FundFormModal
        open={modalOpen || editingFund !== null}
        editingFund={editingFund}
        submitting={submitting}
        defaultCategory={activeTab}
        onSubmit={editingFund ? handleEdit : handleCreate}
        onCancel={() => {
          setModalOpen(false);
          setEditingFund(null);
        }}
      />
    </>
  );
}
