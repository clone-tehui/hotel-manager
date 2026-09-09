import axios from 'axios';
import { LlmProvider, AgentCompletion } from './contracts';
// Keep the provider call bounded so the deterministic advisory fallback can
// preserve portfolio coverage when a provider stalls.
export const OPENROUTER_REQUEST_TIMEOUT_MS = 75_000;
export const CONTROLLED_PROVIDER_TIMEOUT_MS = 5_000;
export const providerTimeoutMs = (endpoint: string, requestedMs: number) => endpoint.includes('127.0.0.1') || endpoint.includes('localhost') ? Math.min(requestedMs, CONTROLLED_PROVIDER_TIMEOUT_MS) : Math.min(requestedMs, OPENROUTER_REQUEST_TIMEOUT_MS);

export class OpenRouterProvider implements LlmProvider {
  constructor(private endpoint: string, private apiKey: string) {}
  async complete(input: Parameters<LlmProvider['complete']>[0]): Promise<AgentCompletion> {
    const response = await axios.post(this.endpoint, { model: input.model, messages: input.messages, tools: input.tools, tool_choice: input.toolChoice ?? 'auto', reasoning: { enabled: false }, temperature: 0.2, max_tokens: input.maxTokens, response_format: { type: 'json_object' } }, { timeout: providerTimeoutMs(this.endpoint, input.timeoutMs), headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://chiluxe.vn', 'X-Title': 'ChiHome Agentic CEO' } });
    const choice = response.data?.choices?.[0]; const message = choice?.message ?? {};
    return { model: response.data?.model, message: { role: 'assistant', content: message.content ?? null, tool_calls: message.tool_calls }, finishReason: choice?.finish_reason, usage: { promptTokens: response.data?.usage?.prompt_tokens, completionTokens: response.data?.usage?.completion_tokens, reasoningTokens: response.data?.usage?.completion_tokens_details?.reasoning_tokens, estimatedCost: response.data?.usage?.cost } };
  }
}
