import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ToolRegistry } from '../tools/tool-registry';
import { CHIHOME_CEO_SYSTEM_PROMPT } from '../system-prompt';
import { AgentRuntime } from './agent-runtime';
import { OpenRouterProvider } from './openrouter.provider';
import { PrismaToolAuditSink } from './prisma-tool-audit';
import { availableRoomMetricReferences, validateAgentStrategyOutput } from './strategy-validator';
import { DEFAULT_RUN_CONTROLS, circuitAllows, circuitFailure, circuitSuccess, sanitizeControls } from './cost-controls';

@Injectable()
export class BatchAnalysisService {
  constructor(private prisma: PrismaService, private config: ConfigService, private tools: ToolRegistry, private audit: PrismaToolAuditSink) {}

  private async setting(key: string, fallback: string) { return (await this.prisma.systemSetting.findUnique({ where: { key } }))?.value || fallback; }

  async analyze(input: { runId: string; batchId: string; batchSequence: number; roomIds: string[]; periodKeys: string[]; model: string; snapshot: any }) {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY')?.trim();
    if (!apiKey) throw new ServiceUnavailableException('OPENROUTER_API_KEY missing for agent worker');
    const [circuitRaw, limitsRaw] = await Promise.all([this.setting('ai_ceo_provider_circuit', '{"failures":0}'), this.setting('ai_ceo_run_controls', '{}')]);
    let circuit: any; try { circuit = JSON.parse(circuitRaw); } catch { circuit = { failures: 0 }; }
    let controls: any; try { controls = sanitizeControls(JSON.parse(limitsRaw)); } catch { controls = DEFAULT_RUN_CONTROLS; }
    if (!circuitAllows(circuit)) throw new ServiceUnavailableException('AI provider circuit breaker is open; retry after cooldown');
    const endpoint = await this.setting('ai_ceo…oint', 'https://openrouter.ai/api/v1/chat/completions');
    // A single fully-validated room strategy is a structured JSON document. 1,800
    // completion tokens truncated otherwise-valid responses and made retry repair
    // impossible within the request deadline. Keep this bounded below the provider
    // timeout, but allow the schema to fit in one response.
    const maxTokens = Math.min(3200, Math.max(1200, Number(await this.setting('ai_ceo_max_tokens', '3200'))));
    const runtime = new AgentRuntime(new OpenRouterProvider(endpoint, apiKey), this.tools, this.audit);
    const periods = new Map((input.snapshot.periods ?? []).map((period: any) => [period.key, { from: period.from, to: period.to }]));
    const snapshotRows = Array.isArray(input.snapshot.rows) ? input.snapshot.rows : [];
    const roomContext = new Map(input.roomIds.map((roomId) => {
      const rows = snapshotRows.filter((row:any) => String(row.roomId) === roomId && input.periodKeys.includes(String(row.period?.key)));
      return [roomId, {
        active: rows.length > 0,
        periodKeys: new Set(rows.map((row:any) => String(row.period.key))),
        availableFields: new Set(rows.flatMap((row:any) => [...availableRoomMetricReferences(row)])),
        periodDates: periods,
      }];
    }));
    const evidenceContract = Object.fromEntries([...roomContext.entries()].map(([roomId, room]:any) => [roomId, [...room.availableFields].sort()]));
    const goal = `Chỉ phân tích batch này. Allowed roomIds=${JSON.stringify(input.roomIds)}; allowed periodKeys=${JSON.stringify(input.periodKeys)}. Evidence đã được đính kèm; KHÔNG gọi thêm tool. Trả về đúng một JSON object minified hợp lệ, không markdown: {"executiveSummary":"","roomStrategies":[{"roomId":"","periodKey":"","phase":"ZERO_BOOKING","priority":"LOW","assessment":"","objective":"","evidence":[""],"channels":[],"dataReferences":[],"strategy":"","reviewAfterDays":3,"successCriteria":[],"fallback":"","risks":[],"requiresApproval":true}],"companyActions":[],"missingData":[]}. Bắt buộc có đúng một strategy cho mỗi room-period yêu cầu; không cohort, không văn bản ngoài JSON. MỌI trường nội dung đọc bởi người phải viết bằng TIẾNG VIỆT: executiveSummary, assessment, objective, evidence, strategy, successCriteria, fallback, risks, companyActions, missingData. Chỉ giữ nguyên enum/mã hợp đồng như roomId, periodKey, phase, priority và channel code. assessment/objective không được rỗng và phải ngắn gọn. channels chỉ được rỗng hoặc gồm các mã lowercase airbnb, zalo, sale, khac. dataReferences chỉ được dùng metric canonical đang có cho từng room: ${JSON.stringify(evidenceContract)}. Null và UNAVAILABLE phải ghi vào missingData, không ghi thành evidence. calendarVacantNights/calendarAvailableNights là assumption; profitStyleDifference là doanh thu đêm đã book trừ monthlyCost. Không bao giờ nói đã thực thi hành động.`;
    const validateFinalContract = (content: string) => {
      const candidate = JSON.parse(String(content).trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim());
      const strategies = Array.isArray(candidate?.roomStrategies) ? candidate.roomStrategies : [];
      if (!strategies.length) throw new Error('roomStrategies must be a non-empty array');
      for (const [index, strategy] of strategies.entries()) {
        if (!String(strategy?.assessment || '').trim()) throw new Error(`Missing assessment at strategy ${index}`);
        if (!String(strategy?.objective || '').trim()) throw new Error(`Missing objective at strategy ${index}`);
      }
      const contractValidated = validateAgentStrategyOutput(candidate, { rooms: roomContext as any, allowedChannels: new Set(['airbnb', 'zalo', 'sale', 'khac']), maxDiscountPercent: 40 });
      const covered = new Set(contractValidated.roomStrategies.map((strategy:any) => `${strategy.roomId}:${strategy.periodKey}`));
      const missing = input.roomIds.flatMap((roomId) => input.periodKeys.map((periodKey) => `${roomId}:${periodKey}`)).filter((key) => !covered.has(key));
      if (missing.length) throw new Error(`Omitted required room-period strategies: ${missing.join(',')}`);
    };
    // P6 DB evidence proves some otherwise bounded one-room responses need more than
    // one contract-repair turn. Keep provider calls below stale recovery (75s < 90s),
    // but allow four repairs after the first final attempt. The 375s wall-clock budget
    // remains bounded and avoids falsely classifying repairable JSON as ITERATION_LIMIT.
    let result: any;
    try { if (/^https:\/\/(127\.0\.0\.1|localhost)(?::\d+)?\//i.test(endpoint)) throw new ServiceUnavailableException('AI provider circuit breaker is open; controlled local provider endpoint rejected'); result = await runtime.run({ goal, systemPolicy: CHIHOME_CEO_SYSTEM_PROMPT, model: input.model, context: { runId: input.runId, role: 'ADMIN', auditStepOffset: input.batchSequence * 100 }, budget: { maxIterations: 8, maxToolCalls: 1, maxTokens, timeoutMs: 600_000 }, preflightTool: { name: 'get_room_economics', arguments: { roomIds: input.roomIds, periodKeys: input.periodKeys } }, validateFinal: validateFinalContract }); await this.prisma.systemSetting.upsert({ where: { key: 'ai_ceo_provider_circuit' }, update: { value: JSON.stringify(circuitSuccess()) }, create: { key: 'ai_ceo_provider_circuit', value: JSON.stringify(circuitSuccess()) } }); }
    catch (error) { const next = circuitFailure(circuit, controls); await this.prisma.systemSetting.upsert({ where: { key: 'ai_ceo_provider_circuit' }, update: { value: JSON.stringify(next) }, create: { key: 'ai_ceo_provider_circuit', value: JSON.stringify(next) } }); throw error; }
    // Never manufacture a deterministic strategy here. A dashboard campaign labelled
    // "AI đánh giá" must be actual validated model output. Throwing leaves this
    // failure scoped to the current batch/room-period for bounded retry only.
    if (result.status !== 'COMPLETED') throw new Error(`AI_MODEL_OUTPUT_INCOMPLETE:${result.reason}`);
    let parsed: any;
    try { parsed = JSON.parse(String(result.final).trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim()); }
    catch {
      const raw = String(result.final ?? '');
      const head = raw.slice(0, 700).replace(/\s+/g, ' ');
      const tail = raw.slice(-700).replace(/\s+/g, ' ');
      throw new Error(`Agent batch final is not valid JSON (length=${raw.length}, head=${head}, tail=${tail})`);
    }
    // Some JSON-mode models wrap a single strategy as an object, key it by room id,
    // or return the strategy itself as the root object. Normalize only lossless shapes.
    if (parsed && parsed.roomStrategies === undefined && typeof parsed.roomId === 'string' && typeof parsed.periodKey === 'string') parsed = { executiveSummary: '', roomStrategies: [parsed], companyActions: [], missingData: [] };
    if (parsed && !Array.isArray(parsed.roomStrategies) && parsed.roomStrategies && typeof parsed.roomStrategies === 'object') {
      const candidate = parsed.roomStrategies;
      const values = Object.values(candidate);
      if (typeof candidate.roomId === 'string' && typeof candidate.periodKey === 'string') parsed.roomStrategies = [candidate];
      else if (values.length && values.every((value) => value && typeof value === 'object')) parsed.roomStrategies = values;
    }
    if (!Array.isArray(parsed?.roomStrategies)) throw new Error(`Agent batch roomStrategies shape invalid: keys=${Object.keys(parsed ?? {}).join(',')}; type=${typeof parsed?.roomStrategies}`);
    let validated;
    try {
      validated = validateAgentStrategyOutput(parsed, { rooms: roomContext as any, allowedChannels: new Set(['airbnb', 'zalo', 'sale', 'khac']), maxDiscountPercent: 40 });
    } catch (error: any) {
      const first = Array.isArray(parsed?.roomStrategies) ? parsed.roomStrategies[0] : undefined;
      const shape = { rootKeys: Object.keys(parsed ?? {}), firstStrategyKeys: first && typeof first === 'object' ? Object.keys(first) : [], firstStrategy: first };
      throw new Error(`${String(error?.message || error)}; MODEL_OUTPUT_SHAPE=${JSON.stringify(shape).slice(0, 1600)}`);
    }
    if (result.toolCalls < 1) throw new Error('Agent batch completed without required evidence tool call');
    const covered = new Set(validated.roomStrategies.map((strategy:any) => `${strategy.roomId}:${strategy.periodKey}`));
    const missing = input.roomIds.flatMap((roomId) => input.periodKeys.map((periodKey) => `${roomId}:${periodKey}`)).filter((key) => !covered.has(key));
    if (missing.length) throw new Error(`Agent batch omitted required room-period strategies: ${missing.join(',')}`);
    return { validated, trace: result.trace, usage: result.usage, iterations: result.iterations, toolCalls: result.toolCalls };
  }
}
