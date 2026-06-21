import { View } from '@tarojs/components';
import { useLoad } from '@tarojs/taro';
import { useState } from 'react';
import { api } from '../../api';
type Event = { id: string; eventType: string; occurredAt: string; summary: string };
export default function TimelinePage() { const [events, setEvents] = useState<Event[]>([]); useLoad(params => { void api<Event[]>(`/pets/${params.petId}/timeline`).then(setEvents); }); return <View className="page"><View className="section-title">照护时间线</View>{events.map(event => <View className="card" key={event.id}><View className="row"><View>{event.summary}</View><View className="status">{event.eventType}</View></View><View className="muted">{new Date(event.occurredAt).toLocaleString()}</View></View>)}{!events.length && <View className="muted">确认记录或完成任务后，会在这里留下可追溯的变化。</View>}</View>; }
