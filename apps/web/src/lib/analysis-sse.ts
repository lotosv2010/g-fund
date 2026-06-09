const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

interface SSECallbacks {
  onToolCall: (tool: string, content: string) => void;
  onToolResult: (tool: string, content: string) => void;
  onResult: (content: string) => void;
  onError: (message: string) => void;
}

export function startAnalysisStream(
  query: string,
  callbacks: SSECallbacks,
): () => void {
  const url = `${BASE_URL}/analysis/stream?query=${encodeURIComponent(query)}`;
  const es = new EventSource(url);

  es.onmessage = (e: MessageEvent) => {
    try {
      const d = JSON.parse(e.data) as {
        tool?: string;
        phase?: string;
        content?: string;
      };

      if (d.tool && d.phase === "call") {
        callbacks.onToolCall(d.tool, d.content ?? "");
      } else if (d.tool && d.phase === "result") {
        callbacks.onToolResult(d.tool, d.content ?? "");
      } else {
        callbacks.onResult(e.data);
      }
    } catch {
      callbacks.onResult(e.data);
    }
  };

  es.onerror = () => {
    es.close();
    callbacks.onError("连接中断，请重试");
  };

  return () => es.close();
}
