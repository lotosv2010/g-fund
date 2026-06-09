const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

const RECONNECT_DELAYS_MS = [1000, 2000, 4000];

export interface HistoryTurn {
  readonly role: "user" | "assistant";
  readonly content: string;
}

interface SSECallbacks {
  onThinking: (content: string) => void;
  onToolCall: (tool: string, content: string) => void;
  onToolResult: (tool: string, content: string) => void;
  onResult: (content: string, truncated: boolean) => void;
  onError: (message: string) => void;
  onReconnect?: (attempt: number, delayMs: number) => void;
}

interface ServerEvent {
  kind?: string;
  tool?: string;
  content?: string;
  truncated?: boolean;
}

export interface StartAnalysisOptions {
  readonly query: string;
  readonly history?: HistoryTurn[];
}

export function startAnalysisStream(
  options: StartAnalysisOptions,
  callbacks: SSECallbacks,
): () => void {
  let aborted = false;
  let completed = false;
  let es: EventSource | null = null;
  let attempt = 0;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    if (es) {
      es.close();
      es = null;
    }
  };

  const finishOk = (content: string, truncated: boolean) => {
    if (aborted || completed) return;
    completed = true;
    cleanup();
    callbacks.onResult(content, truncated);
  };

  const finishErr = (msg: string) => {
    if (aborted || completed) return;
    completed = true;
    cleanup();
    callbacks.onError(msg);
  };

  const open = async () => {
    if (aborted || completed) return;
    try {
      const res = await fetch(`${BASE_URL}/analysis/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });
      if (!res.ok) {
        throw new Error(`创建会话失败 (${res.status})`);
      }
      const { sessionId } = (await res.json()) as { sessionId: string };
      if (aborted || completed) return;

      const url = `${BASE_URL}/analysis/stream?sessionId=${encodeURIComponent(sessionId)}`;
      es = new EventSource(url);

      es.onmessage = (e: MessageEvent) => {
        let payload: ServerEvent;
        try {
          payload = JSON.parse(e.data) as ServerEvent;
        } catch {
          finishOk(e.data, false);
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
            finishOk(payload.content ?? "", payload.truncated ?? false);
            return;
          case "error":
            finishErr(payload.content ?? "未知错误");
            return;
          default:
            return;
        }
      };

      es.onerror = () => {
        if (completed || aborted) return;
        cleanup();
        if (attempt < RECONNECT_DELAYS_MS.length) {
          const delay = RECONNECT_DELAYS_MS[attempt];
          attempt += 1;
          callbacks.onReconnect?.(attempt, delay);
          pendingTimer = setTimeout(() => {
            void open();
          }, delay);
          return;
        }
        finishErr("连接中断，已重试 3 次仍失败");
      };
    } catch (err) {
      if (aborted || completed) return;
      if (attempt < RECONNECT_DELAYS_MS.length) {
        const delay = RECONNECT_DELAYS_MS[attempt];
        attempt += 1;
        callbacks.onReconnect?.(attempt, delay);
        pendingTimer = setTimeout(() => {
          void open();
        }, delay);
        return;
      }
      finishErr((err as Error).message ?? "请求失败");
    }
  };

  void open();

  return () => {
    aborted = true;
    cleanup();
  };
}
