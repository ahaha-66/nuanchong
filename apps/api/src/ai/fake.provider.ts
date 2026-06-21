import { Injectable } from '@nestjs/common';
import type { ExtractionResult } from '@nuanchong/contracts';
import type { AiProvider, AudioInput, ExtractionInput, Transcript } from './ai.provider';
@Injectable()
export class FakeAiProvider implements AiProvider {
  readonly model = 'fake-observation-v1';
  async transcribe(_input: AudioInput): Promise<Transcript> { return { text: '今天早上吃了一半猫粮', model: this.model }; }
  async extractObservation(input: ExtractionInput): Promise<ExtractionResult> {
    return { category: 'APPETITE', occurredAt: { value: new Date().toISOString(), evidence: '今天', confidence: 0.7 }, summary: { value: input.text, evidence: input.text, confidence: 0.95 }, safetyNotice: '该结果仅用于照护记录，不构成诊断。' };
  }
}

