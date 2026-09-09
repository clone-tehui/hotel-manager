import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ToolAuditEvent, ToolAuditSink } from './contracts';

function sanitize(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  const jsonValue = (value as { toJSON?: () => unknown }).toJSON;
  if (typeof jsonValue === 'function') return sanitize(jsonValue.call(value));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) =>
    [key, /secret|token|password|api.?key|authorization/i.test(key) ? '[REDACTED]' : sanitize(entry)]));
}

/** Prisma Json fields accept plain JSON values only. The stringify/parse boundary
 * removes custom prototypes (including Prisma Decimal) after redaction and
 * normalizes anything the recursive sanitizer missed without mutating tool output.
 */
function prismaJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(sanitize(value)));
}

@Injectable()
export class PrismaToolAuditSink implements ToolAuditSink {
  constructor(private readonly prisma: PrismaService) {}
  async record(event: ToolAuditEvent) {
    const data = {
      toolName: event.toolName,
      input: prismaJson(event.input) as any,
      output: event.output ? prismaJson(event.output) as any : undefined,
      status: event.status,
      error: event.error?.slice(0, 1000),
      durationMs: event.output?.meta.durationMs,
      sourceMetadata: event.output?.meta ? prismaJson(event.output.meta) as any : undefined,
      completedAt: event.status === 'RUNNING' ? null : new Date(),
    };
    await this.prisma.aiAgentToolCall.upsert({ where: { runId_step: { runId: event.runId, step: event.step } }, create: { runId: event.runId, step: event.step, ...data }, update: data });
  }
}
export { sanitize as sanitizeToolAudit, prismaJson as toPrismaJson };
