interface ReasonerPolicyInput {
  messageCountSinceReasoner: number;
  lastReasonerRunAt: Date | null;
  now?: Date;
  hasRunningJob: boolean;
  messageThreshold?: number;
  timeThresholdMs?: number;
}

export const DEFAULT_REASONER_MESSAGE_THRESHOLD = 3;
export const DEFAULT_REASONER_TIME_THRESHOLD_MS = 60 * 1000;

export function shouldTriggerReasoner(input: ReasonerPolicyInput) {
  if (input.hasRunningJob) {
    return false;
  }

  const now = input.now ?? new Date();
  const messageThreshold = input.messageThreshold ?? DEFAULT_REASONER_MESSAGE_THRESHOLD;
  const timeThresholdMs = input.timeThresholdMs ?? DEFAULT_REASONER_TIME_THRESHOLD_MS;

  if (input.messageCountSinceReasoner >= messageThreshold) {
    return true;
  }

  if (!input.lastReasonerRunAt) {
    return false;
  }

  return now.getTime() - input.lastReasonerRunAt.getTime() >= timeThresholdMs;
}
