import { Button, Input, Picker, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { api } from '../../api';
type Pet = { id: string; name: string; species: string };
type Task = { id: string; status: string; version: number; scheduledAt: string; definition: { title: string } };
export default function HomePage() {
  const [pets, setPets] = useState<Pet[]>([]); const [selected, setSelected] = useState(0); const [tasks, setTasks] = useState<Task[]>([]); const [name, setName] = useState('');
  async function load() { const list = await api<Pet[]>('/pets'); setPets(list); if (list[selected]) setTasks(await api<Task[]>(`/pets/${list[selected].id}/tasks`)); }
  useDidShow(() => { void load().catch(() => Taro.reLaunch({ url: '/pages/login/index' })); });
  async function complete(task: Task) { try { await api(`/tasks/${task.id}/complete`, { method: 'POST', data: { version: task.version, outcome: 'COMPLETED' } }); await load(); } catch (error) { Taro.showToast({ title: error instanceof Error ? error.message : '任务已被他人处理', icon: 'none' }); await load(); } }
  async function createPet() { if (!name) return; await api('/pets', { method: 'POST', data: { name, species: 'CAT', sex: 'UNKNOWN' } }); setName(''); await load(); }
  const pet = pets[selected];
  return <View className="page"><View className="row"><View><Text className="brand">暖宠</Text><View className="muted">今日照护</View></View>{pet && <Picker mode="selector" range={pets.map(p => p.name)} value={selected} onChange={e => { setSelected(Number(e.detail.value)); setTimeout(() => void load(), 0); }}><View className="status">{pet.name} ▾</View></Picker>}</View>{!pet && <View className="section card"><View className="section-title">创建第一只宠物</View><Input className="input" placeholder="宠物名字" value={name} onInput={e => setName(e.detail.value)} /><Button className="button" onClick={createPet}>创建照护档案</Button></View>}{pet && <><View className="section"><View className="section-title">待完成</View>{tasks.filter(t => ['PENDING','CLAIMED'].includes(t.status)).map(task => <View className="card" key={task.id}><View className="row"><View><View>{task.definition.title}</View><View className="muted">{new Date(task.scheduledAt).toLocaleString()}</View></View><Button size="mini" className="button" onClick={() => complete(task)}>完成</Button></View></View>)}{!tasks.some(t => ['PENDING','CLAIMED'].includes(t.status)) && <View className="card muted">当前没有待完成任务</View>}</View><View className="section row"><Button className="button" onClick={() => Taro.navigateTo({ url: `/pages/pet/index?petId=${pet.id}` })}>记录状态</Button><Button className="button button-secondary" onClick={() => Taro.navigateTo({ url: `/pages/timeline/index?petId=${pet.id}` })}>查看时间线</Button></View></>}</View>;
}

