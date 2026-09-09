export type JsonSchema = Record<string, unknown>;
export type AgentMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_call_id?: string; tool_calls?: AgentToolCall[] };
export type AgentToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
export type AgentCompletion = { model?: string; message: AgentMessage; finishReason?: string; usage?: { promptTokens?: number; completionTokens?: number; reasoningTokens?: number; estimatedCost?: number } };
export type AgentToolDefinition = { type: 'function'; function: { name: string; description: string; strict: true; parameters: JsonSchema } };
export interface LlmProvider { complete(input: { model: string; messages: AgentMessage[]; tools: AgentToolDefinition[]; maxTokens: number; timeoutMs: number; toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } } }): Promise<AgentCompletion>; }
export type ToolContext = { runId: string; userId?: string; role: string; signal?: AbortSignal; auditStepOffset?: number };
export type ToolAuditEvent = { runId: string; step: number; toolName: string; input: Record<string, unknown>; output?: ToolResult; status: 'RUNNING' | 'COMPLETED' | 'FAILED'; error?: string };
export interface ToolAuditSink { record(event: ToolAuditEvent): Promise<void>; }
export type ToolResult = { ok: boolean; data?: unknown; error?: { code: string; message: string; retryable: boolean }; meta: { generatedAt: string; sourceUpdatedAt?: string; freshnessStatus: 'FRESH' | 'STALE' | 'UNKNOWN'; durationMs: number; sources: string[] } };
export interface AgentTool { definition: AgentToolDefinition; readOnly: boolean; timeoutMs: number; authorize(context: ToolContext): boolean; validate(input: unknown): Record<string, unknown>; execute(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult>; }
