import { useState, useEffect } from 'react';
import api from '../api';
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';
import { AlertTriangle, Play, CheckCircle2, Clock, TrendingUp, Users, Target } from 'lucide-react';

const segmentColors = {
  '重点唤醒': '#EF4444',
  '保持温度': '#F97316',
  '低优先唤醒': '#3B82F6',
  '沉睡观察': '#6B7280',
};

export default function DashboardBoard({ onGenerateStrategy }) {
  const [stats, setStats] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [candidatesRes, statsRes] = await Promise.all([
        api.get('/candidates/segmented'),
        api.get('/stats'),
      ]);
      setCandidates(candidatesRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPieData = () => {
    if (!stats?.segment_counts) return [];
    return Object.entries(stats.segment_counts).map(([name, value]) => ({
      name,
      value,
      color: segmentColors[name],
    }));
  };

  const getBarData = () => {
    if (!stats?.interview_stage_counts) return [];
    return Object.entries(stats.interview_stage_counts).map(([name, value]) => ({
      name,
      value,
    }));
  };

  const getTodoList = () => {
    return candidates.filter(c => c.segment === '重点唤醒' || c.overdue_followup);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100">
          <p className="font-medium text-gray-900">{item.name}</p>
          <p className="text-sm text-gray-600">人数: {item.value}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">今日待捞人数</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{getTodoList().length}</p>
              <p className="mt-1 text-xs text-gray-400">重点唤醒 + 超时未跟进</p>
            </div>
            <div className="p-3 rounded-lg bg-red-100">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">总候选人数</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{stats?.total_candidates || 0}</p>
              <p className="mt-1 text-xs text-gray-400">全部在库候选人</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-100">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">超时未跟进</p>
              <p className="mt-1 text-2xl font-bold text-orange-600">{stats?.overdue_followup_total || 0}</p>
              <p className="mt-1 text-xs text-gray-400">需紧急处理</p>
            </div>
            <div className="p-3 rounded-lg bg-orange-100">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">RFM 分层分布</h3>
            <span className="text-xs text-gray-500">人数占比</span>
          </div>
          <div className="h-72">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getPieData()}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ strokeWidth: 1, stroke: '#E5E7EB' }}
                  >
                    {getPieData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {Object.entries(segmentColors).map(([name, color]) => (
              <div key={name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-gray-600">{name}</span>
                <span className="text-xs font-medium text-gray-900">
                  {stats?.segment_counts?.[name] || 0}人
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">面试阶段分布</h3>
            <span className="text-xs text-gray-500">候选人数量</span>
          </div>
          <div className="h-72">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getBarData()} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill="#6366F1" radius={[0, 4, 4, 0]}>
                    {getBarData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(${240 - index * 20}, 70%, 60%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {getBarData().map((item) => (
              <span key={item.name} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                {item.name}: {item.value}人
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Target className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">今日待捞清单</h3>
              <p className="text-xs text-gray-500">重点唤醒 + 面后超时未跟进</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
            {getTodoList().length} 项待处理
          </span>
        </div>

        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto" />
            </div>
          ) : getTodoList().length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-500">暂无待捞候选人</p>
              <p className="text-xs text-gray-400 mt-1">所有候选人状态良好</p>
            </div>
          ) : (
            getTodoList().map((candidate) => (
              <div key={candidate.id} className="px-5 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${candidate.segment === '重点唤醒' ? 'bg-red-500' : 'bg-orange-500'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{candidate.name}</span>
                      {candidate.overdue_followup && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                          <AlertTriangle className="w-3 h-3" />
                          面后超时
                        </span>
                      )}
                      {candidate.segment === '重点唤醒' && !candidate.overdue_followup && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                          <TrendingUp className="w-3 h-3" />
                          重点唤醒
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{candidate.position}</span>
                      <span>·</span>
                      <span>{candidate.interview_stage || '未面试'}</span>
                      <span>·</span>
                      <span>最近联系 {candidate.last_contact_days} 天</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onGenerateStrategy(candidate)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  一键生成策略
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}