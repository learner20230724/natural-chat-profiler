import { ProfileSnapshot } from '../types';

export interface MergeProfileInput {
  current: ProfileSnapshot | null;
  incoming: Record<string, string | null | undefined>;
  reasoningSummary?: string | null;
  confidence?: Record<string, number> | null;
}

export function mergeProfileSnapshot(input: MergeProfileInput) {
  const current = input.current;
  const nextValues: Record<string, string | null> = {
    ...(current?.values ?? {}),
  };

  Object.entries(input.incoming).forEach(([key, value]) => {
    const normalized = normalizeValue(value);
    if (normalized !== undefined) {
      nextValues[key] = normalized;
    }
  });

  return {
    values: nextValues,
    confidence: input.confidence ?? current?.confidence ?? null,
    reasoningSummary: input.reasoningSummary ?? current?.reasoningSummary ?? null,
  };
}

function normalizeValue(value: unknown) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  return undefined;
}
