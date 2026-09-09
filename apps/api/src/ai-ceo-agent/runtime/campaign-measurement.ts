export type CampaignMeasurementStatus = 'MEASURED' | 'INSUFFICIENT_DATA';
export type CampaignOutcome = 'IMPROVED' | 'DECLINED' | 'NO_MATERIAL_CHANGE' | 'INSUFFICIENT_DATA';

type Metrics = {
  bookedNights: number;
  revenue: number;
  occupancy: number | null;
  adr: number | null;
  revPar: number | null;
};

const numberOrNull = (value: unknown): number | null => {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};

const rounded = (value: number | null) => value == null ? null : Number(value.toFixed(2));

export function measureCampaignOutcome(input: {
  baseline: unknown;
  actual: unknown;
  periodTo: Date;
  measuredAt?: Date;
  sourceGeneratedAt: string;
}) {
  const measuredAt = input.measuredAt ?? new Date();
  if (input.periodTo.getTime() >= measuredAt.getTime()) {
    return insufficient('Campaign period has not ended', input.sourceGeneratedAt, measuredAt);
  }
  const baseline = input.baseline as any;
  const actual = input.actual as any;
  const baselineMetrics: Metrics = {
    bookedNights: numberOrNull(baseline?.bookedNights) ?? NaN,
    revenue: numberOrNull(baseline?.bookedNightRevenue) ?? NaN,
    occupancy: numberOrNull(baseline?.occupancy),
    adr: numberOrNull(baseline?.adr),
    revPar: numberOrNull(baseline?.revPar),
  };
  const actualMetrics: Metrics = {
    bookedNights: numberOrNull(actual?.occupiedNights) ?? NaN,
    revenue: numberOrNull(actual?.bookedNightRevenue) ?? NaN,
    occupancy: numberOrNull(actual?.occupancyRate),
    adr: null,
    revPar: null,
  };
  actualMetrics.adr = actualMetrics.bookedNights > 0 ? actualMetrics.revenue / actualMetrics.bookedNights : null;
  const sellable = numberOrNull(actual?.totalNightsInPeriod);
  actualMetrics.revPar = sellable && sellable > 0 ? actualMetrics.revenue / sellable : null;
  if (![baselineMetrics.bookedNights, baselineMetrics.revenue, actualMetrics.bookedNights, actualMetrics.revenue].every(Number.isFinite)) {
    return insufficient('Baseline or actual booked-night data is unavailable', input.sourceGeneratedAt, measuredAt);
  }
  const deltas = {
    bookedNights: actualMetrics.bookedNights - baselineMetrics.bookedNights,
    revenue: actualMetrics.revenue - baselineMetrics.revenue,
    occupancy: baselineMetrics.occupancy == null || actualMetrics.occupancy == null ? null : rounded(actualMetrics.occupancy - baselineMetrics.occupancy),
    adr: baselineMetrics.adr == null || actualMetrics.adr == null ? null : rounded(actualMetrics.adr - baselineMetrics.adr),
    revPar: baselineMetrics.revPar == null || actualMetrics.revPar == null ? null : rounded(actualMetrics.revPar - baselineMetrics.revPar),
  };
  const outcome: CampaignOutcome = deltas.revenue > 0 || deltas.bookedNights > 0
    ? 'IMPROVED'
    : deltas.revenue < 0 || deltas.bookedNights < 0 ? 'DECLINED' : 'NO_MATERIAL_CHANGE';
  return {
    status: 'MEASURED' as CampaignMeasurementStatus,
    outcome,
    measuredAt: measuredAt.toISOString(),
    source: { generatedAt: input.sourceGeneratedAt, system: 'dashboard-report', limitation: 'Dashboard report is derived from current reservation records; attribution and confounders are not inferred.' },
    baseline: baselineMetrics,
    actual: actualMetrics,
    deltas,
    confounders: ['No causal attribution is claimed; outcome compares stored proposal baseline with the same campaign period report.'],
  };
}

function insufficient(reason: string, sourceGeneratedAt: string, measuredAt: Date) {
  return {
    status: 'INSUFFICIENT_DATA' as CampaignMeasurementStatus,
    outcome: 'INSUFFICIENT_DATA' as CampaignOutcome,
    measuredAt: measuredAt.toISOString(),
    source: { generatedAt: sourceGeneratedAt, system: 'dashboard-report' },
    reason,
    confounders: ['No causal attribution is claimed.'],
  };
}
