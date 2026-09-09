import { Injectable, OnModuleInit } from '@nestjs/common';
import { DashboardService } from '../../dashboard/dashboard.service';
import { RoomIntelligenceService } from '../room-intelligence.service';
import { AgentTool, ToolContext } from '../runtime/contracts';
import { ToolRegistry } from './tool-registry';

function objectInput(value: unknown) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Tool input must be an object'); return value as Record<string, unknown>; }
function admin(context: ToolContext) { return context.role === 'ADMIN'; }

@Injectable()
export class AiCeoReadTools implements OnModuleInit {
  constructor(private registry: ToolRegistry, private rooms: RoomIntelligenceService, private dashboard: DashboardService) {}
  onModuleInit() { this.registry.register(this.roomEconomics()); this.registry.register(this.executiveSnapshot()); }

  private roomEconomics(): AgentTool {
    return {
      readOnly: true, timeoutMs: 30_000, authorize: admin,
      definition: { type: 'function', function: { name: 'get_room_economics', description: 'Read deterministic room economics for selected rooms and active business periods. Returns null/unavailable instead of guessing.', strict: true, parameters: { type: 'object', additionalProperties: false, properties: { roomIds: { type: 'array', items: { type: 'string' }, maxItems: 20 }, periodKeys: { type: 'array', items: { type: 'string', enum: ['thisWeek', 'nextWeek', 'thisMonth', 'nextMonth'] }, maxItems: 4 } } } } },
      validate: (raw) => { const input = objectInput(raw); const roomIds = input.roomIds == null ? undefined : (Array.isArray(input.roomIds) ? input.roomIds.map(String).slice(0, 20) : (() => { throw new Error('roomIds must be an array'); })()); const periodKeys = input.periodKeys == null ? undefined : (Array.isArray(input.periodKeys) ? input.periodKeys.map(String) : (() => { throw new Error('periodKeys must be an array'); })()); const allowed = ['thisWeek','nextWeek','thisMonth','nextMonth']; if (periodKeys?.some((key) => !allowed.includes(key))) throw new Error('Invalid period key'); return { roomIds, periodKeys }; },
      execute: async (input) => ({ ok: true, data: await this.rooms.getRoomEconomics(input as any), meta: { generatedAt: new Date().toISOString(), freshnessStatus: 'FRESH', durationMs: 0, sources: ['rooms','reservations','dashboard-report'] } }),
    };
  }

  private executiveSnapshot(): AgentTool {
    return {
      readOnly: true, timeoutMs: 30_000, authorize: admin,
      definition: { type: 'function', function: { name: 'get_executive_snapshot', description: 'Read the current verified company dashboard summary. Sensitive guest PII is not returned.', strict: true, parameters: { type: 'object', additionalProperties: false, properties: {} } } },
      validate: objectInput,
      execute: async () => ({ ok: true, data: await this.dashboard.getSummary(), meta: { generatedAt: new Date().toISOString(), freshnessStatus: 'FRESH', durationMs: 0, sources: ['rooms','reservations','guests-aggregate'] } }),
    };
  }
}
