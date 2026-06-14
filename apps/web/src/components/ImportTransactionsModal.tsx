"use client";
import { useState, useCallback } from "react";
import { Modal, Upload, Button, Select, Table, Typography, Space, Alert, message } from "antd";
import { UploadOutlined, DownloadOutlined, InboxOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd";
import type { ImportResult, ImportError } from "@g-fund/types";
import { transactionsApi } from "@/lib/api-client";

const { Text, Link } = Typography;
const { Dragger } = Upload;

interface ImportTransactionsModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const FORMAT_OPTIONS = [
  { value: "auto", label: "自动检测" },
  { value: "alipay", label: "支付宝" },
  { value: "tiantian", label: "天天基金" },
  { value: "danjuan", label: "蛋卷基金" },
  { value: "generic", label: "通用格式" },
];

const SAMPLE_CSV = `基金代码,交易类型,金额,份额,净值,交易日期,备注
110022,买入,10000.00,5000.0000,2.0000,2026-01-15,定投
003834,买入,5000.00,3000.0000,1.6667,2026-01-15,
110022,卖出,3000.00,1500.0000,2.0000,2026-02-01,部分赎回`;

export default function ImportTransactionsModal({ open, onClose, onSuccess }: ImportTransactionsModalProps) {
  const [format, setFormat] = useState("auto");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleImport = useCallback(async () => {
    if (!file) {
      message.warning("请先选择文件");
      return;
    }

    setLoading(true);
    try {
      const importResult = await transactionsApi.import(file, format);
      setResult(importResult);

      if (importResult.succeeded > 0) {
        message.success(`成功导入 ${importResult.succeeded} 条交易记录`);
        onSuccess();
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "导入失败");
    } finally {
      setLoading(false);
    }
  }, [file, format, onSuccess]);

  const handleDownloadSample = useCallback(() => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "交易导入模板.csv";
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleClose = useCallback(() => {
    setFile(null);
    setResult(null);
    onClose();
  }, [onClose]);

  const errorColumns = [
    { title: "行号", dataIndex: "row", width: 80 },
    { title: "字段", dataIndex: "field", width: 120 },
    { title: "错误信息", dataIndex: "message" },
  ];

  return (
    <Modal
      title="批量导入交易记录"
      open={open}
      onCancel={handleClose}
      width={640}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          关闭
        </Button>,
        <Button
          key="import"
          type="primary"
          loading={loading}
          onClick={handleImport}
          disabled={!file}
        >
          开始导入
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <Alert
          type="info"
          showIcon
          message="支持 CSV 格式，兼容支付宝、天天基金、蛋卷基金导出格式"
          description={
            <Space>
              <Text>下载</Text>
              <Link onClick={handleDownloadSample}>
                <DownloadOutlined /> 导入模板
              </Link>
            </Space>
          }
        />

        <div>
          <Text strong>数据格式：</Text>
          <Select
            value={format}
            onChange={setFormat}
            options={FORMAT_OPTIONS}
            style={{ width: 200, marginLeft: 8 }}
          />
        </div>

        <Dragger
          accept=".csv,.txt"
          maxCount={1}
          beforeUpload={(f) => {
            setFile(f);
            setResult(null);
            return false;
          }}
          onRemove={() => {
            setFile(null);
            setResult(null);
          }}
          fileList={file ? [file as unknown as UploadFile] : []}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽 CSV 文件到此区域</p>
          <p className="ant-upload-hint">支持 .csv 和 .txt 格式，最大 10MB</p>
        </Dragger>

        {result && (
          <div>
            <Space style={{ marginBottom: 8 }}>
              <Text>总计: {result.total}</Text>
              <Text type="success">成功: {result.succeeded}</Text>
              <Text type="danger">失败: {result.failed}</Text>
            </Space>

            {result.errors.length > 0 && (
              <Table
                columns={errorColumns}
                dataSource={result.errors}
                rowKey={(r) => `${r.row}-${r.field}`}
                size="small"
                pagination={false}
                scroll={{ y: 200 }}
              />
            )}
          </div>
        )}
      </Space>
    </Modal>
  );
}
