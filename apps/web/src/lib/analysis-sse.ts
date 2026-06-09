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

  es.addEventListener("tool_call", (e) => {
    const d = JSON.parse((e as MessageEvent).data) as {
      tool: string;
      content: string;
    };
    callbacks.onToolCall(d.tool, d.content);
  });

  es.addEventListener("tool_result", (e) => {
    const d = JSON.parse((e as MessageEvent).data) as {
      tool: string;
      content: string;
    };
    callbacks.onToolResult(d.tool, d.content);
  });

  es.addEventListener("result", (e) => {
    es.close();
    callbacks.onResult((e as MessageEvent).data);
  });

  es.addEventListener("error", () => {
    es.close();
    callbacks.onError("连接中断，请重试");
  });

  return () => es.close();
}
