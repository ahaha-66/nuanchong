import { Button, Input, Picker, Textarea, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useState } from 'react';
import { api } from '../../api';

type Extraction = { id: string; status: string; result?: { category: string; summary: { value: string }; occurredAt: { value: string }; safetyNotice?: string } };
type Plan = { id: string; title: string; status: string; version: number };
type Question = { key: string; label: string; type: 'BOOLEAN' | 'SINGLE_CHOICE' | 'TEXT' | 'NUMBER'; required: boolean; options?: string[] };
type Followup = { id: string; status: string; definition: { title: string; questionSchema: Question[] } };

export default function PetPage() {
  const [petId, setPetId] = useState('');
  const [text, setText] = useState('');
  const [extraction, setExtraction] = useState<Extraction>();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [responses, setResponses] = useState<Record<string, string | number | boolean>>({});

  useLoad(params => {
    setPetId(params.petId);
    void api<Plan[]>(`/care-plans/pet/${params.petId}`).then(setPlans);
    void api<Followup[]>(`/pets/${params.petId}/followups`).then(setFollowups);
  });
  async function extract() { setExtraction(await api<Extraction>('/ai/extractions', { method: 'POST', data: { petId, text } })); }
  async function confirm() { if (!extraction?.result) return; await api(`/ai/extractions/${extraction.id}/confirm`, { method: 'POST', data: { result: extraction.result } }); Taro.showToast({ title: '已加入时间线' }); setText(''); setExtraction(undefined); }
  async function confirmPlan(plan: Plan) { await api(`/care-plans/${plan.id}/confirm`, { method: 'POST', data: { version: plan.version } }); setPlans(await api(`/care-plans/pet/${petId}`)); }
  async function quickRecord(category: string, summary: string) { await api(`/pets/${petId}/observations`, { method: 'POST', data: { category, summary, occurredAt: new Date().toISOString() } }); Taro.showToast({ title: '已记录', icon: 'success' }); }
  async function submitFollowup(item: Followup) { try { await api(`/followups/${item.id}/submit`, { method: 'POST', data: { responses } }); Taro.showToast({ title: '已提交医院', icon: 'success' }); setResponses({}); setFollowups(await api(`/pets/${petId}/followups`)); } catch (error) { Taro.showToast({ title: error instanceof Error ? error.message : '请完成必填项', icon: 'none' }); } }
  const pendingFollowup = followups.find(item => item.status === 'SENT');

  return <View className="page">
    {pendingFollowup && <View className="card followup-form"><View className="section-title">{pendingFollowup.definition.title}</View><View className="muted">提交后进入医院异步随访队列，不代表实时接警。</View>{pendingFollowup.definition.questionSchema.map(question => <View className="question" key={question.key}><View>{question.label}{question.required ? ' *' : ''}</View>{question.type === 'SINGLE_CHOICE' ? <Picker mode="selector" range={question.options ?? []} onChange={event => setResponses(current => ({ ...current, [question.key]: question.options?.[Number(event.detail.value)] ?? '' }))}><View className="picker-value">{String(responses[question.key] ?? '请选择')}</View></Picker> : question.type === 'BOOLEAN' ? <Picker mode="selector" range={['是', '否']} onChange={event => setResponses(current => ({ ...current, [question.key]: Number(event.detail.value) === 0 }))}><View className="picker-value">{responses[question.key] === undefined ? '请选择' : responses[question.key] ? '是' : '否'}</View></Picker> : <Input className="input question-input" type={question.type === 'NUMBER' ? 'number' : 'text'} value={String(responses[question.key] ?? '')} onInput={event => setResponses(current => ({ ...current, [question.key]: question.type === 'NUMBER' ? Number(event.detail.value) : event.detail.value }))} />}</View>)}<Button className="button" onClick={() => submitFollowup(pendingFollowup)}>提交随访</Button></View>}
    <View className="section-title">快速记录</View><View className="muted">常规状态一次点击即可完成，正常与未记录会明确区分。</View><View className="quick-grid section"><View className="quick-item" onClick={() => quickRecord('APPETITE', '今日食欲正常')}><View className="quick-icon">食</View><View>食欲正常</View></View><View className="quick-item" onClick={() => quickRecord('ACTIVITY', '今日精神与活动正常')}><View className="quick-icon">动</View><View>精神正常</View></View><View className="quick-item" onClick={() => quickRecord('STOOL', '今日排便正常')}><View className="quick-icon">便</View><View>排便正常</View></View></View>
    <View className="section-title section">补充描述</View><Textarea className="textarea" value={text} placeholder="例如：今天早上只吃了半碗，精神比昨天差一点" onInput={event => setText(event.detail.value)} /><Button className="button section" disabled={!text} onClick={extract}>AI 整理后确认</Button>{extraction?.result && <View className="card section"><View className="section-title">请确认记录</View><View>{extraction.result.summary.value}</View><View className="muted">类别：{extraction.result.category}</View>{extraction.result.safetyNotice && <View className="warning section">{extraction.result.safetyNotice}</View>}<Button className="button section" onClick={confirm}>确认并保存</Button></View>}
    <View className="section"><View className="section-title">待确认计划</View>{plans.filter(plan => plan.status === 'PENDING_CONFIRMATION').map(plan => <View className="card" key={plan.id}><View>{plan.title}</View><View className="muted">来源：医院下发 · 确认后才会生成任务</View><Button className="button section" onClick={() => confirmPlan(plan)}>查看并确认</Button></View>)}{!plans.some(plan => plan.status === 'PENDING_CONFIRMATION') && <View className="muted">暂无待确认计划</View>}</View><View className="safety-note">AI 只整理你明确记录的信息，不诊断、不调整药物剂量。</View>
  </View>;
}
