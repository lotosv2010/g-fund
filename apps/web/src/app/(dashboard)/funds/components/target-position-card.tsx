"use client";

import { Button, Space, Card } from "antd";
import { EditOutlined } from "@ant-design/icons";

interface TargetPositionCardProps {
  value: string;
  onEdit: () => void;
}

export function TargetPositionCard({ value, onEdit }: TargetPositionCardProps) {
  return (
    <Card size="small" style={{ background: "#f0f5ff", borderColor: "#adc6ff" }}>
      <Space>
        <span style={{ color: "#595959" }}>目标总仓位：</span>
        <span style={{ fontWeight: 600, fontSize: 16 }}>
          ¥{parseFloat(value).toLocaleString()}
        </span>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={onEdit}>
          编辑
        </Button>
      </Space>
    </Card>
  );
}
