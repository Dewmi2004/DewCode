import React from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useApp } from '../../context/AppContext';
import TopBar from '../layout/TopBar';

const weeklyData = [
  { day: 'Mon', commits: 14 },
  { day: 'Tue', commits: 20 },
  { day: 'Wed', commits: 15 },
  { day: 'Thu', commits: 25 },
  { day: 'Fri', commits: 22 },
  { day: 'Sat', commits: 8 },
  { day: 'Sun', commits: 5 },
];

const usageTrend = [
  { month: 'Jan', value: 50 },
  { month: 'Feb', value: 57 },
  { month: 'Mar', value: 62 },
  { month: 'Apr', value: 59 },
  { month: 'May', value: 68 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="px-3 py-2 rounded-md text-xs" style={{ background: '#1A1A26', border: '1px solid rgba(0,212,184,0.3)', color: '#E2E8F0' }}>
        <p style={{ color: '#9CA3AF' }}>{label}</p>
        <p style={{ color: '#00D4B8' }}>{payload[0].name}: {payload[0].value}</p>
      </div>
    );
  }
  return null;
};

const StatCard: React.FC<{ label: string; value: string; icon: string; color: string }> = ({ label, value, icon, color }) => (
  <div className="card p-5 flex items-start justify-between">
    <div>
      <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
    <span className="text-xl" style={{ color }}>{icon}</span>
  </div>
);

const Dashboard: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { user, projects } = useApp();

  return (
    <div className="flex flex-col flex-1 min-h-screen" style={{ background: '#0A0A0F' }}>
      <TopBar />
      <div className="flex-1 p-6 overflow-auto">
        <div className="mb-6 animate-fade-in">
          <h2 className="text-xl font-semibold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Welcome back, {user?.name}!
          </h2>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Here's what's happening with your projects today.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6 animate-fade-in">
          <StatCard label="Total Projects" value="3" icon="📁" color="#00D4B8" />
          <StatCard label="Active Sessions" value="3" icon="⚡" color="#00D4B8" />
          <StatCard label="Code Lines" value="12.5K" icon="</>" color="#00D4B8" />
          <StatCard label="Hours Coded" value="156" icon="⏱" color="#00D4B8" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Weekly Activity</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A26" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="commits" fill="#00D4B8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Usage Trend</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={usageTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A26" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="value" stroke="#00D4B8" strokeWidth={2} dot={{ fill: '#00D4B8', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Projects */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Recent Projects</h3>
            <button className="text-xs font-medium transition-colors" style={{ color: '#00D4B8' }}
              onClick={() => onNavigate('projects')}>View All</button>
          </div>
          <div className="space-y-3">
            {projects.map(p => (
              <div key={p.id} className="flex items-center justify-between py-3 border-b last:border-0" style={{ borderColor: '#1A1A26' }}>
                <div>
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{p.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(0,212,184,0.1)', color: '#00D4B8' }}>{p.language}</span>
                    <span className="text-xs" style={{ color: '#6B7280' }}>Last modified: {p.lastModified}</span>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.2)' }}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
