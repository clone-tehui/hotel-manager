export type MeasuredOutcome = 'IMPROVED' | 'DECLINED' | 'NO_MATERIAL_CHANGE' | 'INSUFFICIENT_DATA';

export function buildMeasuredCampaignLesson(campaign: any) {
  const measurement = campaign?.reviewResult as any;
  if (campaign?.measurementStatus !== 'MEASURED' || !measurement || measurement.status !== 'MEASURED') return null;
  if (!['IMPROVED', 'DECLINED', 'NO_MATERIAL_CHANGE'].includes(campaign.measurementOutcome)) return null;
  const deltas = measurement.deltas;
  if (!deltas || !Number.isFinite(Number(deltas.revenue)) || !Number.isFinite(Number(deltas.bookedNights))) return null;
  const outcome = campaign.measurementOutcome as MeasuredOutcome;
  const confidence = outcome === 'NO_MATERIAL_CHANGE' ? 60 : 70;
  return {
    category: 'campaign-learning',
    key: `campaign-measurement:${campaign.id}`,
    importance: outcome === 'DECLINED' ? 8 : 6,
    confidence,
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    provenance: {
      kind: 'LESSON', sourceCampaignId: campaign.id, sourceRunId: campaign.runId || null,
      measurementStatus: campaign.measurementStatus, measurementOutcome: outcome,
      measuredAt: campaign.measuredAt, source: campaign.measurementSource?.system || 'dashboard-report',
    },
    content: {
      statement: `Campaign ${campaign.id} for room ${campaign.roomNumber} measured ${outcome}.`,
      campaign: { id: campaign.id, roomId: campaign.roomId, roomNumber: campaign.roomNumber, periodKey: campaign.periodKey, objective: campaign.objective },
      outcome,
      deltas,
      limitations: measurement.confounders || ['No causal attribution is claimed.'],
      advisoryOnly: true,
    },
  };
}
