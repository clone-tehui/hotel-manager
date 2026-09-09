import { BadRequestException } from '@nestjs/common';
import { AgentMessage, LlmProvider, ToolAuditSink, ToolContext } from './contracts';
import { ToolRegistry } from '../tools/tool-registry';

function modelToolContent(result: any) {
  // Audit retains full raw evidence; model receives only a bounded evidence view.
  // Large raw snapshots caused provider stalls despite a healthy direct completion path.
  const rows = Array.isArray(result?.data?.rows) ? result.data.rows.map((row: any) => ({
    roomId: row.roomId, roomCode: row.roomCode, period: row.period, bookedNights: row.bookedNights,
    occupancy: row.occupancy, bookedNightRevenue: row.bookedNightRevenue, adr: row.adr, revPar: row.revPar,
    availability: row.availability, economics: row.economics, referencePrice: row.referencePrice,
    discountablePrice: row.discountablePrice, unavailable: row.unavailable, metricProvenance: row.metricProvenance,
  })) : undefined;
  return JSON.stringify(rows ? { ok: result.ok, data: { businessTimezone: result.data?.businessTimezone, generatedAt: result.data?.generatedAt, periods: result.data?.periods, rows }, meta: result.meta } : result);
}
export type AgentBudget = { maxIterations: number; maxToolCalls: number; maxTokens: number; timeoutMs: number };
export class AgentRuntime {
  constructor(private provider: LlmProvider, private tools: ToolRegistry, private audit?: ToolAuditSink) {}
  async run(input: { goal: string; systemPolicy: string; model: string; context: ToolContext; budget: AgentBudget; preflightTool?: { name: string; arguments: Record<string, unknown> }; validateFinal?: (content: string) => void }) {
    const started = Date.now(); let toolCalls = 0; let promptTokens = 0; let completionTokens = 0; let reasoningTokens = 0; let estimatedCost = 0;
    const messages: AgentMessage[] = [{ role: 'system', content: input.systemPolicy }, { role: 'user', content: input.goal }];
    const trace: any[] = [];
    if (input.preflightTool) {
      toolCalls++;
      const callId = 'preflight-1';
      const auditStep = (input.context.auditStepOffset ?? 0) + toolCalls;
      const args = input.preflightTool.arguments;
      await this.audit?.record({ runId: input.context.runId, step: auditStep, toolName: input.preflightTool.name, input: args, status: 'RUNNING' });
      const result = await this.tools.execute(input.preflightTool.name, args, input.context);
      await this.audit?.record({ runId: input.context.runId, step: auditStep, toolName: input.preflightTool.name, input: args, output: result, status: result.ok ? 'COMPLETED' : 'FAILED', error: result.error?.message });
      if (!result.ok) throw new BadRequestException(`Preflight evidence tool failed: ${result.error?.message ?? input.preflightTool.name}`);
      messages.push({ role: 'assistant', content: null, tool_calls: [{ id: callId, type: 'function', function: { name: input.preflightTool.name, arguments: JSON.stringify(args) } }] });
      messages.push({ role: 'tool', tool_call_id: callId, content: modelToolContent(result) });
      trace.push({ iteration: 0, model: 'runtime', finishReason: 'preflight', toolCalls: [input.preflightTool.name] });
    }
    for (let iteration = 1; iteration <= input.budget.maxIterations; iteration++) {
      if (Date.now() - started >= input.budget.timeoutMs) return { status: 'INSUFFICIENT_DATA', reason: 'TIME_BUDGET_EXCEEDED', trace, usage: { promptTokens, completionTokens, reasoningTokens, estimatedCost } };
      // Preflight already attached the exact, audited evidence. Do not let a slow model
      // spend the remaining batch budget issuing redundant tool calls for it.
      const tools = input.preflightTool ? [] : this.tools.definitions();
      const completion = await this.provider.complete({ model: input.model, messages, tools, maxTokens: input.budget.maxTokens, timeoutMs: Math.max(1, input.budget.timeoutMs - (Date.now() - started)), toolChoice: input.preflightTool ? 'none' : iteration === 1 ? { type: 'function', function: { name: 'get_room_economics' } } : 'auto' });
      promptTokens += completion.usage?.promptTokens ?? 0; completionTokens += completion.usage?.completionTokens ?? 0; reasoningTokens += completion.usage?.reasoningTokens ?? 0; estimatedCost += completion.usage?.estimatedCost ?? 0;
      messages.push(completion.message);
      const calls = completion.message.tool_calls ?? [];
      trace.push({ iteration, model: completion.model, finishReason: completion.finishReason, toolCalls: calls.map((call) => call.function.name) });
      if (!calls.length) {
        if (!completion.message.content) throw new BadRequestException('Agent returned neither tool calls nor final content');
        if (input.validateFinal) {
          try { input.validateFinal(completion.message.content); }
          catch (error: any) {
            messages.push({ role: 'user', content: `JSON trước đó bị từ chối bởi output contract: ${String(error?.message || error).slice(0, 1200)}. Chỉ trả về một JSON object ĐẦY ĐỦ đã sửa. Giữ evidence hợp lệ; bảo đảm đủ mọi room-period và mỗi strategy có assessment lẫn objective không rỗng. Toàn bộ câu chữ dành cho người đọc phải bằng tiếng Việt. Dùng đúng JSON shape đã yêu cầu, không markdown/prose. Không gọi tool lại trừ khi evidence thực sự thiếu.` });
            trace.at(-1).finalRejected = String(error?.message || error).slice(0, 1200);
            continue;
          }
        }
        return { status: 'COMPLETED', final: completion.message.content, trace, usage: { promptTokens, completionTokens, reasoningTokens, estimatedCost }, iterations: iteration, toolCalls };
      }
      if (toolCalls + calls.length > input.budget.maxToolCalls) return { status: 'INSUFFICIENT_DATA', reason: 'TOOL_BUDGET_EXCEEDED', trace, usage: { promptTokens, completionTokens, reasoningTokens, estimatedCost } };
      for (const call of calls) {
        toolCalls++;
        let args: unknown;
        try { args = JSON.parse(call.function.arguments || '{}'); } catch { args = { __invalidJson: true }; }
        const auditInput = (args && typeof args === 'object' && !Array.isArray(args) ? args : {}) as Record<string, unknown>;
        const auditStep = (input.context.auditStepOffset ?? 0) + toolCalls;
        await this.audit?.record({ runId: input.context.runId, step: auditStep, toolName: call.function.name, input: auditInput, status: 'RUNNING' });
        const result = await this.tools.execute(call.function.name, args, input.context);
        await this.audit?.record({ runId: input.context.runId, step: auditStep, toolName: call.function.name, input: auditInput, output: result, status: result.ok ? 'COMPLETED' : 'FAILED', error: result.error?.message });
        messages.push({ role: 'tool', tool_call_id: call.id, content: modelToolContent(result) });
      }
    }
    return { status: 'INSUFFICIENT_DATA', reason: 'ITERATION_LIMIT', trace, usage: { promptTokens, completionTokens, reasoningTokens, estimatedCost } };
  }
}
