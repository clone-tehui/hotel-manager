export const MEMORY_KINDS = ['FACT', 'HYPOTHESIS', 'LESSON', 'SYNTHESIS'] as const;
export const MEMORY_STATUSES = ['ACTIVE', 'DISABLED', 'INVALIDATED'] as const;
export type MemoryKind = typeof MEMORY_KINDS[number];
export type MemoryStatus = typeof MEMORY_STATUSES[number];

export function validateMemoryControl(input: { confidence?: number; status?: string; expiresAt?: string | null; invalidationReason?: string }) {
  if (input.confidence !== undefined && (!Number.isInteger(input.confidence) || input.confidence < 0 || input.confidence > 100)) throw new Error('confidence must be an integer between 0 and 100');
  if (input.status !== undefined && !(MEMORY_STATUSES as readonly string[]).includes(input.status)) throw new Error('invalid memory status');
  if (input.expiresAt !== undefined && input.expiresAt !== null && Number.isNaN(Date.parse(input.expiresAt))) throw new Error('invalid expiry timestamp');
  if (input.status === 'INVALIDATED' && !input.invalidationReason?.trim()) throw new Error('invalidation reason is required');
}
