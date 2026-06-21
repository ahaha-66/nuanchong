import type { ExtractionResult } from '@nuanchong/contracts';
const DIAGNOSTIC_WORDS = ['确诊', '诊断为', '一定是', '病因是', '无需就医'];
export function enforceMedicalBoundary(result: ExtractionResult): ExtractionResult {
  const summary = String(result.summary.value ?? '');
  if (DIAGNOSTIC_WORDS.some(word => summary.includes(word))) throw new Error('AI output crossed the medical boundary');
  return { ...result, safetyNotice: result.safetyNotice ?? 'AI仅协助整理照护记录，不提供诊断或治疗建议。' };
}

