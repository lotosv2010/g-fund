const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

interface SSECallbacks {
  onThinking: (content: string) => void;
  onToolCall: (tool: string, content: string) => void;
  onToolResult: (tool: string, content: string) => void;
  onResult: (content: string, truncated: boolean) => void;
  onError: (message: string) => void;
}

interface ServerEvent {
  kind?: string;
  tool?: string;
  content?: string;
  truncated?: boolean;
}

export function startAnalysisStream(
  query: string,
  callbacks: SSECallbacks,
): () => void {
  const url = `${BASE_URL}/analysis/stream?query=${encodeURIComponent(query)}`;
  const es = new EventSource(url);
  let completed = false;

  es.onmessage = (e: MessageEvent) => {
    let payload: ServerEvent;
    try {
      payload = JSON.parse(e.data) as ServerEvent;
    } catch {
      callbacks.onResult(e.data, false);
      return;
    }

    switch (payload.kind) {
      case "thinking":
        callbacks.onThinking(payload.content ?? "");
        return;
      case "tool_call":
        callbacks.onToolCall(payload.tool ?? "tool", payload.content ?? "");
        return;
      case "tool_result":
        callbacks.onToolResult(payload.tool ?? "tool", payload.content ?? "");
        return;
      case "result":
        completed = true;
        callbacks.onResult(payload.content ?? "", payload.truncated ?? false);
        es.close();
        return;
      case "error":
        completed = true;
        callbacks.onError(payload.content ?? "未知错误");
        es.close();
        return;
      default:
        return;
    }
  };

  es.onerror = () => {
    if (completed) return;
    completed = true;
    es.close();
    callbacks.onError("连接中断，请重试");
  };

  return () => {
    completed = true;
    es.close();
  };
}
