import { Injectable } from '@nestjs/common';
import { ExtractionResultSchema, type ExtractionResult } from '@nuanchong/contracts';
import type { AiProvider, AudioInput, ExtractionInput, Transcript } from './ai.provider';

const SYSTEM_PROMPT = `你是宠物照护记录结构化助手，不是兽医。只提取用户明确表达的信息，不推测病因、诊断、剂量或时间。输出严格JSON：category, occurredAt, summary, value?, unit?, candidateTaskId?, safetyNotice?。每个字段用 {value,evidence,confidence}，evidence必须是输入原文片段。涉及用药且无法唯一匹配任务时 candidateTaskId 为 null。`;

@Injectable()
export class OpenAiCompatibleProvider implements AiProvider {
  readonly model = process.env.AI_MODEL ?? 'gpt-4.1-mini';
  async transcribe(input: AudioInput): Promise<Transcript> {
    const form = new FormData();
    form.append('model', process.env.ASR_MODEL ?? 'gpt-4o-mini-transcribe');
    const bytes = new Uint8Array(input.bytes).buffer as ArrayBuffer;
    form.append('file', new Blob([bytes], { type: input.contentType }), input.filename);
    const response = await fetch(`${process.env.ASR_BASE_URL ?? process.env.AI_BASE_URL ?? 'https://api.openai.com/v1'}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.ASR_API_KEY ?? process.env.AI_API_KEY}` }, body: form });
    if (!response.ok) throw new Error(`ASR failed: ${response.status}`);
    const body = await response.json() as { text: string };
    return { text: body.text, model: process.env.ASR_MODEL ?? 'gpt-4o-mini-transcribe' };
  }
  async extractObservation(input: ExtractionInput): Promise<ExtractionResult> {
    const response = await fetch(`${process.env.AI_BASE_URL ?? 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify(input) }] }),
    });
    if (!response.ok) throw new Error(`AI extraction failed: ${response.status}`);
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI returned no content');
    return ExtractionResultSchema.parse(JSON.parse(content));
  }
}
