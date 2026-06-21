import { describe, expect, it } from 'vitest';
import { enforceMedicalBoundary } from './medical-safety';
const base = { category: 'OTHER' as const, occurredAt: { value: '2026-06-21T10:00:00Z', evidence: '今天', confidence: 0.8 }, summary: { value: '精神比昨天差', evidence: '精神比昨天差', confidence: 0.9 } };
describe('medical boundary', () => {
  it('adds a non-diagnostic notice', () => expect(enforceMedicalBoundary(base).safetyNotice).toContain('不提供诊断'));
  it('rejects model-created diagnoses', () => expect(() => enforceMedicalBoundary({ ...base, summary: { ...base.summary, value: '确诊为肾病' } })).toThrow());
});

