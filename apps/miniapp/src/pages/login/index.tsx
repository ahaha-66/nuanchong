import { Button, Input, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import { api } from '../../api';
export default function LoginPage() {
  const [email, setEmail] = useState('owner.a@example.com');
  const [loading, setLoading] = useState(false);
  async function login() { setLoading(true); try { const result = await api<{ accessToken: string }>('/auth/dev/login', { method: 'POST', data: { email, displayName: '宠主' } }); Taro.setStorageSync('accessToken', result.accessToken); await Taro.reLaunch({ url: '/pages/home/index' }); } finally { setLoading(false); } }
  async function wechat() { const { code } = await Taro.login(); const result = await api<{ accessToken: string }>('/auth/wechat/login', { method: 'POST', data: { code } }); Taro.setStorageSync('accessToken', result.accessToken); await Taro.reLaunch({ url: '/pages/home/index' }); }
  return <View className="page"><View className="section"><Text className="brand">暖宠</Text><View className="muted">把每天的照护，稳稳接在一起</View></View><View className="section"><View className="section-title">开发账号</View><Input className="input" value={email} onInput={e => setEmail(e.detail.value)} /><Button className="button" loading={loading} onClick={login}>进入照护圈</Button><Button className="button button-secondary" onClick={wechat}>微信登录</Button></View><View className="warning section">暖宠协助记录与协作，不替代兽医诊断。出现紧急情况请及时联系宠物医院。</View></View>;
}

