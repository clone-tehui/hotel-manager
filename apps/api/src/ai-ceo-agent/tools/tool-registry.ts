import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AgentTool, AgentToolDefinition, ToolContext, ToolResult } from '../runtime/contracts';

@Injectable()
export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>();
  register(tool: AgentTool) { const name = tool.definition.function.name; if (this.tools.has(name)) throw new Error(`Duplicate AI tool: ${name}`); this.tools.set(name, tool); }
  definitions(): AgentToolDefinition[] { return [...this.tools.values()].map((tool) => tool.definition); }
  names() { return [...this.tools.keys()]; }
  async execute(name: string, input: unknown, context: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) throw new BadRequestException(`Unknown AI tool: ${name}`);
    if (!tool.readOnly) throw new ForbiddenException(`Write tool is disabled: ${name}`);
    if (!tool.authorize(context)) throw new ForbiddenException(`Not authorized for AI tool: ${name}`);
    const validated = tool.validate(input);
    const started = Date.now();
    try {
      const result = await Promise.race([
        tool.execute(validated, context),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TOOL_TIMEOUT')), tool.timeoutMs)),
      ]);
      return { ...result, meta: { ...result.meta, durationMs: Date.now() - started } };
    } catch (error: any) {
      return { ok: false, error: { code: error?.message === 'TOOL_TIMEOUT' ? 'TOOL_TIMEOUT' : 'TOOL_ERROR', message: String(error?.message || error).slice(0, 500), retryable: error?.message === 'TOOL_TIMEOUT' }, meta: { generatedAt: new Date().toISOString(), freshnessStatus: 'UNKNOWN', durationMs: Date.now() - started, sources: [] } };
    }
  }
}
