"use client";

import { useEffect, useState } from "react";
import {
  Card, Form, Input, Radio, Slider, Switch, Button, App,
  InputNumber, Space, Typography, Divider, Select, Table, Tag,
} from "antd";
import { SaveOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import type { AiConfig, AiProvider, McpConfig, McpServer } from "@g-fund/types";
import {
  AI_PROVIDER_LABELS, DEFAULT_AI_CONFIG, DEFAULT_MCP_CONFIG,
  PROVIDER_MODEL_PRESETS,
} from "@g-fund/types";
import { aiConfigApi, mcpConfigApi } from "@/lib/api-client";

const { Text } = Typography;

const PROVIDERS: AiProvider[] = ["deepseek", "moonshot", "minimax", "xiaomi"];

function newServer(): McpServer {
  return { id: Date.now().toString(), name: "", url: "", apiKey: "", enabled: true };
}

export default function AISettingsPage() {
  const { message } = App.useApp();
  const [aiConfig, setAiConfig] = useState<AiConfig>(DEFAULT_AI_CONFIG);
  const [mcpServers, setMcpServers] = useState<McpConfig>(DEFAULT_MCP_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<AiProvider>("deepseek");

  useEffect(() => {
    Promise.all([
      aiConfigApi.get().catch(() => DEFAULT_AI_CONFIG),
      mcpConfigApi.get().catch(() => DEFAULT_MCP_CONFIG),
    ]).then(([ai, mcp]) => {
      setAiConfig(ai);
      setActiveTab(ai.activeProvider);
      setMcpServers(mcp);
      setLoading(false);
    });
  }, []);

  function setActiveProvider(provider: AiProvider) {
    setAiConfig((prev) => ({ ...prev, activeProvider: provider }));
  }

  function setProviderField<K extends keyof AiConfig["providers"][AiProvider]>(
    provider: AiProvider,
    field: K,
    value: AiConfig["providers"][AiProvider][K],
  ) {
    setAiConfig((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [provider]: { ...prev.providers[provider], [field]: value },
      },
    }));
  }

  function updateServer(id: string, patch: Partial<McpServer>) {
    setMcpServers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeServer(id: string) {
    setMcpServers((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await Promise.all([aiConfigApi.set(aiConfig), mcpConfigApi.set(mcpServers)]);
      message.success("设置已保存");
    } catch (e) {
      message.error((e as Error).message ?? "保存失败");
    } finally {
      setSaving(false);
    }
  }

  const p = activeTab;
  const pc = aiConfig.providers[p];
  const presets = PROVIDER_MODEL_PRESETS[p];

  return (
    <div style={{ maxWidth: 680 }}>
      <Card title="AI 提供商" loading={loading} variant="borderless" style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <Form.Item label="使用的提供商">
            <Radio.Group
              value={aiConfig.activeProvider}
              onChange={(e) => setActiveProvider(e.target.value as AiProvider)}
              optionType="button"
              buttonStyle="solid"
            >
              {PROVIDERS.map((id) => (
                <Radio.Button key={id} value={id}>{AI_PROVIDER_LABELS[id]}</Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>

          <Form.Item label="配置提供商参数" style={{ marginBottom: 0 }}>
            <Radio.Group
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as AiProvider)}
              optionType="button"
              size="small"
            >
              {PROVIDERS.map((id) => (
                <Radio.Button key={id} value={id}>{AI_PROVIDER_LABELS[id]}</Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>
        </Form>

        <Divider style={{ margin: "16px 0 20px" }} />

        <Form layout="vertical">
          <Form.Item label="Base URL">
            <Input
              value={pc.baseURL}
              onChange={(e) => setProviderField(p, "baseURL", e.target.value)}
              placeholder="https://api.example.com/v1"
            />
          </Form.Item>

          <Form.Item label="API Key">
            <Input.Password
              value={pc.apiKey}
              onChange={(e) => setProviderField(p, "apiKey", e.target.value)}
              placeholder="sk-..."
            />
          </Form.Item>

          <Form.Item label="模型">
            <Select
              showSearch
              value={pc.modelName}
              onChange={(v) => setProviderField(p, "modelName", v)}
              placeholder="选择或输入模型名称"
              style={{ width: "100%" }}
              options={presets.map((m) => ({ label: m, value: m }))}
              filterOption={false}
              onSearch={(v) => setProviderField(p, "modelName", v)}
              notFoundContent={null}
            />
          </Form.Item>

          <Form.Item label={`Temperature（${pc.temperature.toFixed(2)}）`}>
            <Space style={{ width: "100%" }}>
              <Slider
                min={0} max={2} step={0.01}
                value={pc.temperature}
                onChange={(v) => setProviderField(p, "temperature", v)}
                style={{ flex: 1, minWidth: 320 }}
              />
              <InputNumber
                min={0} max={2} step={0.01}
                value={pc.temperature}
                onChange={(v) => setProviderField(p, "temperature", v ?? 0)}
                style={{ width: 72 }}
              />
            </Space>
          </Form.Item>

          <Form.Item label="Thinking">
            <Space>
              <Switch
                checked={pc.thinking}
                onChange={(v) => setProviderField(p, "thinking", v)}
              />
              {p !== "moonshot" && (
                <Text type="secondary" style={{ fontSize: 12 }}>仅对 Kimi 生效</Text>
              )}
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title="MCP 服务器"
        loading={loading}
        variant="borderless"
        style={{ marginBottom: 16 }}
        extra={
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setMcpServers((prev) => [...prev, newServer()])}
          >
            添加
          </Button>
        }
      >
        {mcpServers.length === 0 ? (
          <Text type="secondary">暂无 MCP 服务器，点击「添加」配置</Text>
        ) : (
          mcpServers.map((server, idx) => (
            <div key={server.id}>
              {idx > 0 && <Divider style={{ margin: "12px 0" }} />}
              <Form layout="vertical">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Space>
                    <Switch
                      size="small"
                      checked={server.enabled}
                      onChange={(v) => updateServer(server.id, { enabled: v })}
                    />
                    <Text strong style={{ fontSize: 13 }}>{server.name || `服务器 ${idx + 1}`}</Text>
                    {server.enabled && <Tag color="green">启用</Tag>}
                  </Space>
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => removeServer(server.id)}
                  />
                </div>
                <Form.Item label="名称" style={{ marginBottom: 8 }}>
                  <Input
                    size="small"
                    value={server.name}
                    onChange={(e) => updateServer(server.id, { name: e.target.value })}
                    placeholder="盈米 MCP"
                  />
                </Form.Item>
                <Form.Item label="MCP URL" style={{ marginBottom: 8 }}>
                  <Input
                    size="small"
                    value={server.url}
                    onChange={(e) => updateServer(server.id, { url: e.target.value })}
                    placeholder="https://your-mcp-server/mcp/v2"
                  />
                </Form.Item>
                <Form.Item label="API Key" style={{ marginBottom: 0 }}>
                  <Input.Password
                    size="small"
                    value={server.apiKey}
                    onChange={(e) => updateServer(server.id, { apiKey: e.target.value })}
                    placeholder="your-api-key"
                  />
                </Form.Item>
              </Form>
            </div>
          ))
        )}
      </Card>

      <Button
        type="primary"
        icon={<SaveOutlined />}
        loading={saving}
        onClick={handleSave}
        size="large"
      >
        保存设置
      </Button>
    </div>
  );
}
