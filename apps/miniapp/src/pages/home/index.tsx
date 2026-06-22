import { Button, Input, Picker, Progress, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { api } from '../../api';
import './styles.css';

type Pet = { id: string; name: string; species: string };
type Task = { id: string; status: string; version: number; scheduledAt: string; definition: { title: string; kind: string; instructions?: string } };
type CareCard = { stage: string; activePlans: Array<{ id: string; title: string }>; pendingPlans: Array<{ id: string; title: string }>; tasks: Task[]; progress: { completed: number; total: number; rate: number }; focusItems: string[]; recentEvents: Array<{ id: string; summary: string; occurredAt: string }>; followups: Array<{ id: string; status: string; definition: { title: string } }>; disclaimer: string };

export default function HomePage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [selected, setSelected] = useState(0);
  const [card, setCard] = useState<CareCard>();
  const [name, setName] = useState('');

  async function load(index = selected) {
    const list = await api<Pet[]>('/pets');
    setPets(list);
    const pet = list[index] ?? list[0];
    if (pet) setCard(await api<CareCard>(`/pets/${pet.id}/care-card`)); else setCard(undefined);
  }
  useDidShow(() => { void load().catch(() => Taro.reLaunch({ url: '/pages/login/index' })); });
  async function complete(task: Task) {
    try {
      await api(`/tasks/${task.id}/complete`, { method: 'POST', data: { version: task.version, outcome: 'COMPLETED' } });
      await load();
      Taro.showToast({ title: '已完成', icon: 'success' });
    } catch (error) { Taro.showToast({ title: error instanceof Error ? error.message : '任务已被他人处理', icon: 'none' }); await load(); }
  }
  async function createPet() { if (!name) return; await api('/pets', { method: 'POST', data: { name, species: 'CAT', sex: 'UNKNOWN' } }); setName(''); await load(0); }
  const pet = pets[selected] ?? pets[0];
  const pending = card?.tasks.filter(task => ['PENDING', 'CLAIMED', 'OVERDUE'].includes(task.status)) ?? [];
  const planCount = card?.activePlans.length ?? 0;
  const pendingPlanCount = card?.pendingPlans.length ?? 0;
  const followupPending = card?.followups.filter(item => item.status === 'SENT').length ?? 0;

  return <View className="page"><View className="row"><View><Text className="brand">暖宠</Text><View className="muted">今天也稳稳照护</View></View>{pet && <Picker mode="selector" range={pets.map(item => item.name)} value={selected} onChange={event => { const index = Number(event.detail.value); setSelected(index); void load(index); }}><View className="status">{pet.name} ▾</View></Picker>}</View>
    {!pet && <View className="section card"><View className="section-title">创建第一只宠物</View><Input className="input" placeholder="宠物名字" value={name} onInput={event => setName(event.detail.value)} /><Button className="button" onClick={createPet}>创建照护档案</Button></View>}
    {pet && card && <><View className="care-hero section"><View className="row"><View><View className="eyebrow">当前阶段</View><View className="care-stage">{card.stage}</View></View><View className="progress-number">{card.progress.completed}/{card.progress.total}</View></View><Progress percent={card.progress.rate} strokeWidth={8} activeColor="#176b4d" backgroundColor="#dfe8e3" /><View className="care-source">{card.activePlans[0] ? `来自 ${card.activePlans[0].title}` : '尚未建立执行中计划'}</View>
        <View className="care-hero-summary"><View className="summary-pill">执行中计划 {planCount} 项</View>{pendingPlanCount > 0 && <View className="summary-pill warning">医院计划待确认 {pendingPlanCount} 项</View>}{followupPending > 0 && <View className="summary-pill info">待填随访 {followupPending} 项</View>}</View></View>
      {!!pendingPlanCount && <View className="warning section">有 {pendingPlanCount} 项医院计划等待你确认。<View className="text-link" onClick={() => Taro.navigateTo({ url: `/pages/pet/index?petId=${pet.id}` })}>立即查看</View></View>}
      {!!followupPending && <View className="followup-banner section"><View><View className="followup-title">医院随访待填写</View><View className="muted">{card.followups.find(item => item.status === 'SENT')?.definition.title}</View></View><Button size="mini" className="button" onClick={() => Taro.navigateTo({ url: `/pages/pet/index?petId=${pet.id}` })}>去填写</Button></View>}
      <View className="section"><View className="section-title">今日任务</View>{pending.map(task => <View className="card task-card" key={task.id}><View className="task-kind">{task.definition.kind === 'MEDICATION' ? '用药' : task.definition.kind === 'MEASUREMENT' ? '测量' : '照护'}</View><View className="row"><View className="task-content"><View>{task.definition.title}</View><View className="muted">{new Date(task.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {task.definition.instructions ?? '按计划完成并记录'}</View></View><Button size="mini" className="button task-action" onClick={() => complete(task)}>完成</Button></View></View>)}{!pending.length && <View className="card empty-success">今天的待办已完成，可以安心陪伴它了。</View>}</View>
      {!!card.focusItems.length && <View className="section"><View className="section-title">重点观察</View><View className="focus-grid">{card.focusItems.map(item => <View className="focus-chip" key={item}>{item}</View>)}</View></View>}
      {!!card.recentEvents.length && <View className="section"><View className="section-title">最近照护动态</View>{card.recentEvents.slice(0, 3).map(event => <View className="card event-card" key={event.id}><View className="event-summary">{event.summary}</View><View className="muted">{new Date(event.occurredAt).toLocaleString()}</View></View>)}</View>}
      <View className="section action-grid"><Button className="button" onClick={() => Taro.navigateTo({ url: `/pages/pet/index?petId=${pet.id}` })}>记录状态</Button><Button className="button button-secondary" onClick={() => Taro.navigateTo({ url: `/pages/timeline/index?petId=${pet.id}` })}>照护时间线</Button></View>
      <View className="safety-note">{card.disclaimer}</View></>}
  </View>;
}
