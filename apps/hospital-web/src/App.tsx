import { Alert, Button, Card, Col, DatePicker, Empty, Form, Input, Layout, List, Menu, Modal, Progress, Row, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import { Activity, CalendarCheck, Clock3, FileText, LogOut, PawPrint, Plus, Search, Stethoscope, TriangleAlert, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from './api';

const { Header, Sider, Content } = Layout;
type Task = { id: string; scheduledAt: string; status: string; definition: { title: string; kind: string; instructions?: string }; executions: Array<{ actorUserId: string; outcome: string; note?: string; createdAt: string }> };
type Observation = { id: string; occurredAt: string; summary: string; category: string; value?: string; unit?: string };
type Timeline = { id: string; occurredAt: string; summary: string; eventType: string };
type Plan = { id: string; title: string; status: string; updatedAt: string; taskDefinitions: Array<{ id: string; title: string; kind: string; scheduleTimes: string[]; instructions?: string }> };
type TemplateContent = { applicableConditions: string[]; contraindications: string[]; observationFocus: string[]; tasks: Array<{ title: string; kind: string; defaultTime: string; instructions: string }>; disclaimer: string };
type CareTemplate = { id: string; name: string; category: string; diseaseTag?: string; description?: string; versions: Array<{ id: string; number: number; reviewStatus: string; content: TemplateContent; publishedAt?: string }> };
type Followup = { id: string; status: string; scheduledAt: string; submittedAt?: string; responsePayload?: Record<string, string>; assignedToId?: string; pet: { id: string; name: string }; definition: { id: string; title: string; questionSchema: Array<{ key: string; label: string }> } };
type Consent = { endsAt: string; scopes: string[] };
type Pet = { id: string; name: string; species: string; birthDate?: string; consents: [Consent, ...Consent[]]; plans: Plan[]; tasks: Task[]; observations: Observation[]; timeline: Timeline[]; followups: Followup[]; careSummary: { due: number; completed: number; completionRate: number; abnormal: number; lastUpdate?: string; queue: string } };

const speciesName: Record<string, string> = { DOG: '犬', CAT: '猫', OTHER: '其他' };
const statusName: Record<string, string> = { PENDING: '待完成', CLAIMED: '处理中', COMPLETED: '已完成', SKIPPED: '已跳过', ABNORMAL: '执行异常', OVERDUE: '已延迟', ACTIVE: '执行中', PENDING_CONFIRMATION: '待宠主确认' };
const queueColor: Record<string, string> = { 执行异常: 'red', 待确认计划: 'gold', 长期未更新: 'orange', 照护进行中: 'green' };
const followupStatusColor: Record<string, string> = { SENT: 'gold', SUBMITTED: 'orange', CLAIMED: 'blue', COMPLETED: 'green' };
const followupStatusName: Record<string, string> = { SENT: '待宠主提交', SUBMITTED: '待领取', CLAIMED: '医院处理中', COMPLETED: '已完成' };

function Login({ onLogin }: { onLogin: (organizationId: string) => void }) {
  const [loading, setLoading] = useState(false);
  async function submit(values: { email: string; password: string; organizationId: string }) {
    setLoading(true);
    try {
      const result = await api<{ accessToken: string; organizationId: string }>('/auth/hospital/login', { method: 'POST', body: values });
      localStorage.setItem('accessToken', result.accessToken);
      localStorage.setItem('organizationId', values.organizationId);
      onLogin(values.organizationId);
    } catch (error) { message.error(error instanceof Error ? error.message : '登录失败'); }
    finally { setLoading(false); }
  }
  return <main className="login-shell"><section className="login-panel"><div className="wordmark"><span>暖宠</span><small>医院协作台</small></div><Typography.Title level={3}>登录医院工作区</Typography.Title><Typography.Paragraph type="secondary">查看宠主明确授权范围内的连续照护数据</Typography.Paragraph><Form layout="vertical" onFinish={submit} initialValues={{ email: 'vet@hospital-a.example.com', password: 'WarmPet2026!' }}><Form.Item name="email" label="工作邮箱" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="password" label="密码" rules={[{ required: true }]}><Input.Password /></Form.Item><Form.Item name="organizationId" label="医院 ID" rules={[{ required: true }]}><Input placeholder="医院组织 ID" /></Form.Item><Button type="primary" htmlType="submit" block loading={loading}>进入工作台</Button></Form><div className="login-note">医院连接不代表实时监控；紧急情况应使用医院既有急诊渠道。</div></section></main>;
}

function MetricCard({ title, value, suffix, icon, tone }: { title: string; value: number; suffix?: string; icon: React.ReactNode; tone: string }) {
  return <Card className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><Statistic title={title} value={value} suffix={suffix} /></Card>;
}

export function App() {
  const [organizationId, setOrganizationId] = useState(localStorage.getItem('organizationId') ?? '');
  const [page, setPage] = useState('overview');
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [templates, setTemplates] = useState<CareTemplate[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);

  const selected = pets.find(pet => pet.id === selectedId) ?? pets[0];
  const selectedPendingPlans = selected?.plans.filter(plan => plan.status === 'PENDING_CONFIRMATION').length ?? 0;
  const selectedActivePlans = selected?.plans.filter(plan => plan.status === 'ACTIVE').length ?? 0;
  const selectedPendingFollowups = selected?.followups.filter(item => ['SUBMITTED', 'CLAIMED'].includes(item.status)).length ?? 0;
  const filteredPets = pets.filter(pet => pet.name.includes(search));
  async function loadPatients(org = organizationId) {
    if (!org) return;
    setLoading(true);
    try {
      const result = await api<Pet[]>(`/organizations/${org}/patients`, { organizationId: org });
      setPets(result);
      if (!selectedId && result[0]) setSelectedId(result[0].id);
    } catch (error) { message.error(error instanceof Error ? error.message : '无法加载患者'); }
    finally { setLoading(false); }
  }
  async function loadFollowups() { if (!organizationId) return; setFollowups(await api<Followup[]>(`/organizations/${organizationId}/followup-queue`, { organizationId })); }
  useEffect(() => { void loadPatients(); void loadFollowups().catch(() => undefined); void api<CareTemplate[]>('/templates', { organizationId }).then(setTemplates).catch(error => message.error(error instanceof Error ? error.message : '无法加载模板库')); }, [organizationId]);

  const stats = useMemo(() => {
    const due = pets.reduce((sum, pet) => sum + pet.careSummary.due, 0);
    const completed = pets.reduce((sum, pet) => sum + pet.careSummary.completed, 0);
    return { patients: pets.length, activePlans: pets.flatMap(pet => pet.plans).filter(plan => plan.status === 'ACTIVE').length, followups: pets.filter(pet => pet.careSummary.queue !== '照护进行中').length, completion: due ? Math.round(completed / due * 100) : 0 };
  }, [pets]);

  const taskColumns = [
    { title: '任务', dataIndex: ['definition', 'title'], render: (value: string, row: Task) => <div><strong>{value}</strong><small className="table-subtitle">{row.definition.instructions}</small></div> },
    { title: '计划时间', dataIndex: 'scheduledAt', width: 170, render: (value: string) => new Date(value).toLocaleString() },
    { title: '状态', dataIndex: 'status', width: 110, render: (value: string) => <Tag color={value === 'COMPLETED' ? 'green' : value === 'ABNORMAL' ? 'red' : 'default'}>{statusName[value] ?? value}</Tag> },
    { title: '执行备注', width: 180, render: (_: unknown, row: Task) => row.executions[0]?.note ?? '—' },
  ];

  async function createPlan(values: { title: string; taskTitle: string; kind: string; dates: [unknown, unknown]; time: string; instructions?: string }) {
    if (!selected) return;
    const [start, end] = values.dates as [{ format: (value: string) => string }, { format: (value: string) => string }];
    try {
      const plan = await api<{ id: string; version: number }>('/care-plans', { method: 'POST', organizationId, body: { petId: selected.id, title: values.title, timezone: 'Asia/Shanghai', tasks: [{ title: values.taskTitle, kind: values.kind, scheduleTimes: [values.time], startDate: start.format('YYYY-MM-DD'), endDate: end.format('YYYY-MM-DD'), instructions: values.instructions }] } });
      await api(`/care-plans/${plan.id}/publish`, { method: 'POST', organizationId, body: { version: plan.version } });
      message.success('计划已发送，等待宠主确认'); setModal(false); await loadPatients();
    } catch (error) { message.error(error instanceof Error ? error.message : '计划发送失败'); }
  }
  async function applyTemplate(template: CareTemplate) {
    if (!selected) return;
    const version = template.versions.find(item => item.reviewStatus === 'PUBLISHED');
    if (!version) return message.warning('该模板尚未发布');
    const start = new Date(); const end = new Date(Date.now() + 13 * 86400000);
    const date = (value: Date) => value.toISOString().slice(0, 10);
    try {
      const plan = await api<{ id: string; version: number }>('/care-plans', { method: 'POST', organizationId, body: { petId: selected.id, title: template.name, timezone: 'Asia/Shanghai', tasks: version.content.tasks.map(task => ({ title: task.title, kind: task.kind, scheduleTimes: [task.defaultTime], startDate: date(start), endDate: date(end), instructions: task.instructions })) } });
      await api(`/care-plans/${plan.id}/publish`, { method: 'POST', organizationId, body: { version: plan.version } });
      message.success(`已按“${template.name}”生成计划，等待宠主确认`); await loadPatients();
    } catch (error) { message.error(error instanceof Error ? error.message : '模板应用失败'); }
  }
  async function claimFollowup(id: string) { try { await api(`/followups/${id}/claim`, { method: 'POST', organizationId }); message.success('已领取随访'); await loadFollowups(); } catch (error) { message.error(error instanceof Error ? error.message : '领取失败'); } }
  function completeFollowup(item: Followup) { Modal.confirm({ title: `完成 ${item.pet.name} 的随访`, content: '完成后将写入照护时间线，并建议 7 天后复诊。此队列为异步服务，不代表医疗风险处置。', okText: '确认完成', cancelText: '取消', onOk: async () => { const next = new Date(Date.now() + 7 * 86400000).toISOString(); await api(`/followups/${item.id}/complete`, { method: 'POST', organizationId, body: { note: '已查看宠主提交内容并完成异步随访', nextVisitAt: next } }); message.success('随访已完成'); await Promise.all([loadFollowups(), loadPatients()]); } }); }

  if (!organizationId || !localStorage.getItem('accessToken')) return <Login onLogin={setOrganizationId} />;

  function openPatient(pet: Pet) { setSelectedId(pet.id); setPage('patients'); }
  const overview = <>
    <Row gutter={[16, 16]} className="metrics-row"><Col xs={24} sm={12} xl={6}><MetricCard title="授权患者" value={stats.patients} icon={<Users size={20}/>} tone="green" /></Col><Col xs={24} sm={12} xl={6}><MetricCard title="执行中计划" value={stats.activePlans} icon={<CalendarCheck size={20}/>} tone="blue" /></Col><Col xs={24} sm={12} xl={6}><MetricCard title="今日任务完成率" value={stats.completion} suffix="%" icon={<Activity size={20}/>} tone="purple" /></Col><Col xs={24} sm={12} xl={6}><MetricCard title="需要跟进" value={stats.followups} icon={<TriangleAlert size={20}/>} tone="orange" /></Col></Row>
    <Row gutter={[18, 18]}><Col xs={24} xl={15}><Card title="患者照护概览" extra={<Button type="link" onClick={() => setPage('patients')}>查看全部</Button>}><Table loading={loading} rowKey="id" pagination={false} dataSource={pets} onRow={pet => ({ onClick: () => openPatient(pet), className: 'clickable-row' })} columns={[
      { title: '患者', render: (_: unknown, pet: Pet) => <Space><span className="pet-avatar"><PawPrint size={17}/></span><div><strong>{pet.name}</strong><small className="table-subtitle">{speciesName[pet.species]}</small></div></Space> },
      { title: '工作队列', render: (_: unknown, pet: Pet) => <Tag color={queueColor[pet.careSummary.queue]}>{pet.careSummary.queue}</Tag> },
      { title: '近期待办', render: (_: unknown, pet: Pet) => `${pet.careSummary.completed}/${pet.careSummary.due}` },
      { title: '完成率', render: (_: unknown, pet: Pet) => <Progress percent={pet.careSummary.completionRate} size="small" strokeColor="#1f7a55" /> },
      { title: '最近更新', render: (_: unknown, pet: Pet) => pet.careSummary.lastUpdate ? new Date(pet.careSummary.lastUpdate).toLocaleDateString() : '暂无' },
    ]} /></Card></Col><Col xs={24} xl={9}><Card title="待跟进队列"><List dataSource={pets.filter(pet => pet.careSummary.queue !== '照护进行中')} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有待跟进患者"/> }} renderItem={pet => <List.Item onClick={() => openPatient(pet)} className="queue-item"><List.Item.Meta avatar={<span className="queue-dot" />} title={<Space>{pet.name}<Tag color={queueColor[pet.careSummary.queue]}>{pet.careSummary.queue}</Tag></Space>} description={pet.plans[0]?.title ?? '尚未建立医院照护计划'} /></List.Item>} /><Alert className="queue-notice" type="info" showIcon message="队列颜色仅表示运营优先级，不代表医疗风险分级。" /></Card></Col></Row>
    <Card title="医院随访队列" className="followup-card" extra={<Typography.Text type="secondary">员工主动领取后才表示医院处理中</Typography.Text>}><Table rowKey="id" pagination={false} dataSource={followups} columns={[{ title: '患者', dataIndex: ['pet', 'name'] }, { title: '随访', dataIndex: ['definition', 'title'] }, { title: '状态', dataIndex: 'status', render: value => <Tag color={value === 'SUBMITTED' ? 'gold' : value === 'CLAIMED' ? 'blue' : 'default'}>{value === 'SENT' ? '待宠主提交' : value === 'SUBMITTED' ? '待领取' : value === 'CLAIMED' ? '处理中' : value}</Tag> }, { title: '宠主反馈', render: (_: unknown, item: Followup) => item.responsePayload ? Object.values(item.responsePayload).filter(Boolean).join(' · ') : '尚未提交' }, { title: '操作', width: 150, render: (_: unknown, item: Followup) => item.status === 'SUBMITTED' ? <Button size="small" onClick={() => claimFollowup(item.id)}>领取</Button> : item.status === 'CLAIMED' ? <Button size="small" type="primary" onClick={() => completeFollowup(item)}>完成随访</Button> : '—' }]} /></Card>
  </>;

  const patientView = <div className="workspace"><aside className="patient-list"><div className="panel-heading"><span>授权患者</span><Tag>{filteredPets.length}</Tag></div><div className="patient-search"><Input prefix={<Search size={15}/>} placeholder="搜索患者" value={search} onChange={event => setSearch(event.target.value)} /></div><List loading={loading} dataSource={filteredPets} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有有效授权患者"/> }} renderItem={pet => <List.Item className={selected?.id === pet.id ? 'patient active' : 'patient'} onClick={() => setSelectedId(pet.id)}><PawPrint size={18}/><div><strong>{pet.name}</strong><small>{speciesName[pet.species]} · {pet.careSummary.queue}</small></div></List.Item>} /></aside><section className="patient-detail">{selected ? <><div className="detail-title"><div><Space><Typography.Title level={3}>{selected.name}</Typography.Title><Tag color={queueColor[selected.careSummary.queue]}>{selected.careSummary.queue}</Tag></Space><Typography.Text type="secondary">授权至 {new Date(selected.consents[0]?.endsAt).toLocaleDateString()} · 最近更新 {selected.careSummary.lastUpdate ? new Date(selected.careSummary.lastUpdate).toLocaleString() : '暂无'}</Typography.Text></div><Button type="primary" icon={<Plus size={16}/>} onClick={() => setModal(true)}>新建照护计划</Button></div><Row gutter={16} className="patient-metrics"><Col span={8}><Card size="small"><Statistic title="近 7 日任务" value={selected.careSummary.due} prefix={<Clock3 size={16}/>} /></Card></Col><Col span={8}><Card size="small"><Statistic title="完成率" value={selected.careSummary.completionRate} suffix="%" prefix={<Activity size={16}/>} /></Card></Col><Col span={8}><Card size="small"><Statistic title="执行异常" value={selected.careSummary.abnormal} prefix={<TriangleAlert size={16}/>} /></Card></Col></Row><section className="detail-section"><Card size="small" className="patient-brief-card"><div className="brief-row"><div className="brief-item"><strong>{selectedActivePlans}</strong><span>执行中计划</span></div><div className="brief-item"><strong>{selectedPendingPlans}</strong><span>医院待确认计划</span></div><div className="brief-item"><strong>{selectedPendingFollowups}</strong><span>待医院跟进</span></div><div className="brief-item"><strong>{selected.careSummary.due - selected.careSummary.completed}</strong><span>今日待办</span></div></div>{selectedPendingPlans > 0 ? <Typography.Text type="secondary">请优先推动医院下发计划的宠主确认。</Typography.Text> : selectedPendingFollowups > 0 ? <Typography.Text type="secondary">已有待领取或处理中随访，请及时跟进。</Typography.Text> : <Typography.Text type="secondary">当前照护节奏正常，无紧迫待办。</Typography.Text>}</Card></section><section className="detail-section"><div className="section-title-row"><Typography.Title level={5}>照护计划</Typography.Title></div><div className="plan-grid">{selected.plans.map(plan => <Card size="small" key={plan.id} className="plan-card"><div className="plan-title"><strong>{plan.title}</strong><Tag color={plan.status === 'ACTIVE' ? 'green' : 'gold'}>{statusName[plan.status] ?? plan.status}</Tag></div><div className="muted-line">{plan.taskDefinitions.map(item => item.title).join(' · ')}</div></Card>)}{!selected.plans.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未建立照护计划"/>}</div></section><section className="detail-section"><Typography.Title level={5}>任务执行</Typography.Title><Table rowKey="id" size="middle" columns={taskColumns} dataSource={selected.tasks} pagination={{ pageSize: 6, hideOnSinglePage: true }} locale={{ emptyText: '当前时间范围没有任务' }} /></section><Row gutter={18} className="detail-section"><Col xs={24} xl={12}><Card title="近期状态记录"><List dataSource={selected.observations} locale={{ emptyText: '暂无状态记录' }} renderItem={item => <List.Item><List.Item.Meta title={item.summary} description={`${new Date(item.occurredAt).toLocaleString()} · ${item.category}`} /></List.Item>} /></Card></Col><Col xs={24} xl={12}><Card title="照护时间线"><List dataSource={selected.timeline} locale={{ emptyText: '暂无时间线事件' }} renderItem={item => <List.Item><List.Item.Meta avatar={<span className="timeline-icon"><FileText size={14}/></span>} title={item.summary} description={new Date(item.occurredAt).toLocaleString()} /></List.Item>} /></Card></Col></Row></> : <Empty description="选择一位授权患者"/>}</section></div>;

  const planView = <Space direction="vertical" size="large" style={{ width: '100%' }}><Card title="照护计划" extra={<Button type="primary" icon={<Plus size={16}/>} disabled={!selected} onClick={() => setModal(true)}>新建计划</Button>}><Table rowKey="id" dataSource={pets.flatMap(pet => pet.plans.map(plan => ({ ...plan, petName: pet.name })))} columns={[{ title: '患者', dataIndex: 'petName' }, { title: '计划名称', dataIndex: 'title' }, { title: '任务数', render: (_: unknown, plan: Plan) => plan.taskDefinitions.length }, { title: '状态', dataIndex: 'status', render: value => <Tag color={value === 'ACTIVE' ? 'green' : 'gold'}>{statusName[value] ?? value}</Tag> }, { title: '更新时间', dataIndex: 'updatedAt', render: value => new Date(value).toLocaleString() }]} /></Card><Card title="已审核模板库" extra={<Typography.Text type="secondary">仅展示发布版本 · 应用于 {selected?.name ?? '当前患者'}</Typography.Text>}><div className="template-grid">{templates.map(template => { const version = template.versions.find(item => item.reviewStatus === 'PUBLISHED'); return <Card size="small" key={template.id} className="template-card"><div className="plan-title"><Tag>{template.category}</Tag>{version && <Tag color="green">V{version.number} 已发布</Tag>}</div><Typography.Title level={5}>{template.name}</Typography.Title><Typography.Paragraph type="secondary">{template.description}</Typography.Paragraph>{version && <><div className="template-focus">重点观察：{version.content.observationFocus.join(' · ')}</div><div className="muted-line">{version.content.tasks.map(task => task.title).join(' · ')}</div></>}<Button block className="template-action" disabled={!selected || !version} onClick={() => applyTemplate(template)}>使用模板下发</Button></Card>; })}</div></Card></Space>;

  return <Layout className="app-shell"><Sider width={232} theme="light" className="sidebar"><div className="wordmark sidebar-brand"><span>暖宠</span><small>医院协作台</small></div><Menu selectedKeys={[page]} onClick={({ key }) => setPage(key)} items={[{ key: 'overview', icon: <Stethoscope size={17}/>, label: '工作台总览' }, { key: 'patients', icon: <Users size={17}/>, label: '授权患者' }, { key: 'plans', icon: <CalendarCheck size={17}/>, label: '照护计划' }]} /><button className="logout" onClick={() => { localStorage.clear(); setOrganizationId(''); }}><LogOut size={16}/>退出</button></Sider><Layout><Header className="topbar"><div><Typography.Title level={4}>{page === 'overview' ? '连续照护工作台' : page === 'patients' ? '授权患者' : '照护计划'}</Typography.Title><Typography.Text type="secondary">家庭照护数据用于异步随访协作，不替代临床诊疗</Typography.Text></div><div className="service-status"><span/> 服务时间内 · 非实时监控</div></Header><Content className="content">{page === 'overview' ? overview : page === 'patients' ? patientView : planView}</Content></Layout><Modal title={`为 ${selected?.name ?? ''} 新建照护计划`} open={modal} footer={null} onCancel={() => setModal(false)} destroyOnClose><Form layout="vertical" onFinish={createPlan} initialValues={{ kind: 'MEDICATION', time: '08:00' }}><Form.Item name="title" label="计划名称" rules={[{ required: true }]}><Input placeholder="例如：术后两周照护" /></Form.Item><Form.Item name="taskTitle" label="首项任务" rules={[{ required: true }]}><Input placeholder="例如：服用处方药" /></Form.Item><Space size="middle" align="start"><Form.Item name="kind" label="任务类型"><Select style={{ width: 160 }} options={[{ value: 'MEDICATION', label: '用药' }, { value: 'FEEDING', label: '饮食' }, { value: 'MEASUREMENT', label: '测量' }, { value: 'OBSERVATION', label: '观察' }]} /></Form.Item><Form.Item name="time" label="每日时间"><Input placeholder="08:00" /></Form.Item></Space><Form.Item name="dates" label="执行日期" rules={[{ required: true }]}><DatePicker.RangePicker /></Form.Item><Form.Item name="instructions" label="执行说明"><Input.TextArea placeholder="仅填写已由兽医确认的执行说明，不由 AI 生成剂量" /></Form.Item><Button type="primary" htmlType="submit" block>发送给宠主确认</Button></Form></Modal></Layout>;
}
