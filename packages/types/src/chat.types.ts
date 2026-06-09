export interface UserMessage {
  readonly kind: "user";
  readonly id: string;
  readonly content: string;
  readonly timestamp: number;
}

export interface ToolCallMessage {
  readonly kind: "tool_call";
  readonly id: string;
  readonly tool: string;
  readonly content: string;
  readonly timestamp: number;
}

export interface ToolResultMessage {
  readonly kind: "tool_result";
  readonly id: string;
  readonly tool: string;
  readonly content: string;
  readonly timestamp: number;
}

export interface AssistantMessage {
  readonly kind: "assistant";
  readonly id: string;
  readonly content: string;
  readonly timestamp: number;
  readonly truncated?: boolean;
}

export interface ThinkingMessage {
  readonly kind: "thinking";
  readonly id: string;
  readonly content: string;
  readonly timestamp: number;
}

export interface ErrorMessage {
  readonly kind: "error";
  readonly id: string;
  readonly content: string;
  readonly timestamp: number;
}

export type ChatMessage =
  | UserMessage
  | ToolCallMessage
  | ToolResultMessage
  | AssistantMessage
  | ThinkingMessage
  | ErrorMessage;

export interface ChatSessionSummary {
  readonly id: number;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ChatSessionDetail extends ChatSessionSummary {
  readonly messages: ChatMessage[];
}

export type PersistedRole = "user" | "assistant" | "tool" | "system";
export type PersistedKind = ChatMessage["kind"];

export interface PersistChatMessageDto {
  readonly role: PersistedRole;
  readonly kind: PersistedKind;
  readonly content: string;
  readonly tool?: string;
  readonly truncated?: boolean;
}
