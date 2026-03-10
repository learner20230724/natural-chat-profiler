import { ProfileSnapshot } from '../types';

export interface MergeProfileInput {
  current: ProfileSnapshot | null;
  incoming: Partial<Pick<ProfileSnapshot, 'age' | 'hometown' | 'currentCity' | 'personality' | 'expectations'>>;
  reasoningSummary?: string | null;
  confidence?: Record<string, number> | null;
}

export function mergeProfileSnapshot(input: MergeProfileInput) {
  const current = input.current;

  return {
    age: normalizeValue(input.incoming.age) ?? current?.age ?? null,
    hometown: normalizeValue(input.incoming.hometown) ?? current?.hometown ?? null,
    currentCity: normalizeValue(input.incoming.currentCity) ?? current?.currentCity ?? null,
    personality: normalizeValue(input.incoming.personality) ?? current?.personality ?? null,
    expectations: normalizeValue(input.incoming.expectations) ?? current?.expectations ?? null,
    confidence: input.confidence ?? current?.confidence ?? null,
    reasoningSummary: input.reasoningSummary ?? current?.reasoningSummary ?? null,
  };
}

function normalizeValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
