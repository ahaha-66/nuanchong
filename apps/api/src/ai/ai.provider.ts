import type { ExtractionResult } from '@nuanchong/contracts';

export type AudioInput = { bytes: Uint8Array; filename: string; contentType: string };
export type Transcript = { text: string; model: string };
export type ExtractionInput = { text: string; petName?: string; pendingTasks?: Array<{ id: string; title: string }> };
export interface AiProvider {
  transcribe(input: AudioInput): Promise<Transcript>;
  extractObservation(input: ExtractionInput): Promise<ExtractionResult>;
  readonly model: string;
}

