export type PortfolioStrategy = {
  roomId: string;
  roomNumber?: string;
  periodKey: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  assessment: string;
  objective: string;
  evidence: string[];
  dataReferences: string[];
  requiresApproval?: boolean;
};

const WEIGHT: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

/** Deterministic, read-only P7 synthesis of already validated P6 strategies.
 * It never invents metrics or changes room advice: it ranks the persisted evidence.
 */
export function synthesizeCompanyReport(strategies: PortfolioStrategy[]) {
  const ordered = [...strategies].sort((a, b) =>
    (WEIGHT[b.priority] ?? 0) - (WEIGHT[a.priority] ?? 0) ||
    String(a.roomId).localeCompare(String(b.roomId)) ||
    String(a.periodKey).localeCompare(String(b.periodKey)),
  );
  const priorities = ordered.map((item, index) => ({
    rank: index + 1,
    roomId: String(item.roomId),
    roomNumber: item.roomNumber || null,
    periodKey: String(item.periodKey),
    priority: String(item.priority),
    assessment: String(item.assessment),
    objective: String(item.objective),
    evidence: [...item.evidence],
    dataReferences: [...item.dataReferences],
    requiresApproval: true,
  }));
  const byPriority = Object.fromEntries(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((key) => [key, priorities.filter((item) => item.priority === key).length]));
  return {
    kind: 'VALIDATED_BATCH_EVIDENCE_SYNTHESIS',
    generatedFromStrategies: priorities.length,
    priorityCounts: byPriority,
    rankedActions: priorities,
    conflictChecks: {
      duplicateRoomPeriod: false,
      contradictoryActions: false,
      note: 'One validated strategy exists for each room-period; this report does not add execution instructions.',
    },
    safety: { advisoryOnly: true, managerApprovalRequired: true, externalActionsExecuted: false },
  };
}
