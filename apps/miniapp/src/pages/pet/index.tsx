import { Button, Textarea, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useState } from 'react';
import { api } from '../../api';
type Extraction = { id: string; status: string; result?: { category: string; summary: { value: string }; occurredAt: { value: string }; safetyNotice?: string } };
type Plan = { id: string; title: string; status: string; version: number };
export default function PetPage() {
  const [petId, setPetId] = useState(''); const [text, setText] = useState(''); const [extraction, setExtraction] = useState<Extraction>(); const [plans, setPlans] = useState<Plan[]>([]);
  useLoad(params => { setPetId(params.petId); void api<Plan[]>(`/care-plans/pet/${params.petId}`).then(setPlans); });
  async function extract() { const value = await api<Extraction>('/ai/extractions', { method: 'POST', data: { petId, text } }); setExtraction(value); }
  async function confirm() { if (!extraction?.result) return; await api(`/ai/extractions/${extraction.id}/confirm`, { method: 'POST', data: { result: extraction.result } }); Taro.showToast({ title: '已加入时间线' }); setText(''); setExtraction(undefined); }
  async function confirmPlan(plan: Plan) { await api(`/care-plans/${plan.id}/confirm`, { method: 'POST', data: { version: plan.version } }); setPlans(await api(`/care-plans/pet/${petId}`)); }
  return <View className="page"><View className="section-title">快速记录</View><Textarea className="textarea" value={text} placeholder="例如：今天早上只吃了半碗，精神比昨天差一点" onInput={e => setText(e.detail.value)} /><Button className="button section" disabled={!text} onClick={extract}>AI整理</Button>{extraction?.result && <View className="card section"><View className="section-title">请确认记录</View><View>{extraction.result.summary.value}</View><View className="muted">类别：{extraction.result.category}</View><View className="warning section">{extraction.result.safetyNotice}</View><Button className="button section" onClick={confirm}>确认并保存</Button></View>}<View className="section"><View className="section-title">待确认计划</View>{plans.filter(p => p.status === 'PENDING_CONFIRMATION').map(plan => <View className="card row" key={plan.id}><View>{plan.title}</View><Button size="mini" className="button" onClick={() => confirmPlan(plan)}>确认</Button></View>)}{!plans.some(p => p.status === 'PENDING_CONFIRMATION') && <View className="muted">暂无待确认计划</View>}</View></View>;
}

