import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Users, AlertTriangle, Thermometer, Target, Upload, Play, Loader2, AlertCircle, X, Copy, Check, User, Mail, Phone, Briefcase, Clock, Star, MessageSquare, LayoutDashboard, ClipboardList } from 'lucide-react';
import DashboardBoard from './DashboardBoard';

const SegmentTag = ({ segment }) => {
  const styles = {
    '重点唤醒': 'bg-red-100 text-red-700 border-red-200',
    '保持温度': 'bg-orange-100 text-orange-700 border-orange-200',
    '低优先唤醒': 'bg-blue-100 text-blue-700 border-blue-200',
    '沉睡观察': 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[segment] || styles['沉睡观察']}`}>
      {segment}
    </span>
  );
};

const StatCard = ({ icon: Icon, title, value, subtitle, highlight }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 ${highlight ? 'border-red-200 bg-red-50/50' : ''}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className={`mt-1 text-2xl font-bold ${highlight ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
        {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-lg ${highlight ? 'bg-red-100' : 'bg-gray-100'}`}>
        <Icon className={`w-5 h-5 ${highlight ? 'text-red-600' : 'text-gray-500'}`} />
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const [candidates, setCandidates] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [strategyModal, setStrategyModal] = useState(null);
  const [activeTab, setActiveTab] = useState('list');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [candidatesRes, statsRes] = await Promise.all([
        axios.get('/api/candidates/segmented'),
        axios.get('/api/stats'),
      ]);
      setCandidates(candidatesRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post('/api/candidates/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchData();
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const [strategyLoading, setStrategyLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerateStrategy = async (candidate) => {
    setStrategyLoading(true);
    setStrategyModal({ candidate });
    try {
      const res = await axios.post(`/api/candidates/${candidate.id}/strategy`);
      setStrategyModal({
        candidate,
        ...res.data,
      });
    } catch (error) {
      console.error('Generate strategy failed:', error);
      setStrategyModal({
        candidate,
        status: 'error',
        error: '生成策略失败，请稍后重试',
      });
    } finally {
      setStrategyLoading(false);
    }
  };

  const calculateAverageIntent = () => {
    if (!candidates.length) return 0;
    const total = candidates.reduce((sum, c) => sum + c.intent_score, 0);
    return (total / candidates.length).toFixed(1);
  };

  const getSegmentCount = (segment) => {
    return stats?.segment_counts?.[segment] || 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">候选人智能召回工作台</h1>
              <p className="text-xs text-gray-500">招聘运营智能工具</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              导入CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <ClipboardList className="w-4 h-4" />
              候选人列表
            </button>
            <button
              onClick={() => setActiveTab('board')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'board' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <LayoutDashboard className="w-4 h-4" />
              召回看板
            </button>
          </div>
          {activeTab === 'list' && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              导入CSV
            </button>
          )}
        </div>

        {activeTab === 'board' ? (
          <DashboardBoard onGenerateStrategy={handleGenerateStrategy} />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard
                icon={Users}
                title="总候选人数"
                value={stats?.total_candidates || 0}
                subtitle="全部候选人"
              />
              <StatCard
                icon={AlertTriangle}
                title="重点唤醒"
                value={getSegmentCount('重点唤醒')}
                subtitle="高优先级"
                highlight
              />
              <StatCard
                icon={Thermometer}
                title="面后超时未跟进"
                value={stats?.overdue_followup_total || 0}
                subtitle="需紧急处理"
                highlight
              />
              <StatCard
                icon={Target}
                title="平均意向度"
                value={calculateAverageIntent()}
                subtitle="满分5分"
              />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">候选人列表</h2>
            <span className="text-xs text-gray-500">共 {candidates.length} 人</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">姓名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">岗位</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">面试阶段</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">最近联系</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">意向度</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">RFM分层</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center">
                      <Loader2 className="w-6 h-6 text-gray-400 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : candidates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      暂无候选人数据
                    </td>
                  </tr>
                ) : (
                  candidates.map((c) => (
                    <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${c.overdue_followup ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{c.name}</span>
                          {c.overdue_followup && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                              <AlertCircle className="w-3 h-3" />
                              面后超时
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{c.position || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{c.interview_stage || '未面试'}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{c.last_contact_days} 天</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <div
                                key={star}
                                className={`w-3 h-3 rounded-full ${star <= c.intent_score ? 'bg-yellow-400' : 'bg-gray-200'}`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-gray-500 ml-1">{c.intent_score}/5</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <SegmentTag segment={c.segment} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => handleGenerateStrategy(c)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                        >
                          <Play className="w-3.5 h-3.5" />
                          生成策略
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
            </>
        )}
      </main>

      {strategyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-blue-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{strategyModal.candidate.name} 的召回策略</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{strategyModal.candidate.position}</span>
                    <SegmentTag segment={strategyModal.candidate.segment} />
                  </div>
                </div>
              </div>
              <button
                        onClick={() => {
                          setStrategyModal(null);
                          setCopied(false);
                        }}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
            </div>

            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2 text-gray-600">
                  <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                  <span>{strategyModal.candidate.interview_stage || '未面试'}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>最近联系 {strategyModal.candidate.last_contact_days} 天</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Star className="w-3.5 h-3.5 text-yellow-400" />
                  <span>意向度 {strategyModal.candidate.intent_score}/5</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                  <span>{strategyModal.candidate.overdue_followup ? '面后超时' : '正常跟进'}</span>
                </div>
              </div>
              {strategyModal.candidate.phone && (
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  <span>{strategyModal.candidate.phone}</span>
                </div>
              )}
              {strategyModal.candidate.email && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  <span>{strategyModal.candidate.email}</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {strategyLoading ? (
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                  <div className="h-8 bg-gray-200 rounded animate-pulse" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
                      <div className="h-6 bg-gray-200 rounded animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
                      <div className="h-6 bg-gray-200 rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded w-4/5 animate-pulse" />
                  </div>
                </div>
              ) : strategyModal.status === 'error' ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center gap-2 text-red-600 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">生成失败</span>
                  </div>
                  <p className="text-sm text-red-700">{strategyModal.error}</p>
                  <p className="text-xs text-red-500 mt-2">请设置 GEMINI_API_KEY 环境变量后重试</p>
                </div>
              ) : (
                <>
                  <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">风险判断</label>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{strategyModal.risk_judgement}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">推荐渠道</label>
                      <p className="mt-2 text-lg font-semibold text-blue-600">{strategyModal.channel}</p>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">推荐时机</label>
                      <p className="mt-2 text-lg font-semibold text-green-600">{strategyModal.timing}</p>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">召回话术</label>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(strategyModal.script);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          } catch (e) {
                            const textarea = document.createElement('textarea');
                            textarea.value = strategyModal.script;
                            document.body.appendChild(textarea);
                            textarea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textarea);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${copied ? 'bg-green-50 border border-green-200 text-green-600' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'}`}
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? '已复制' : '复制话术'}
                      </button>
                    </div>
                    <div className="p-4 bg-gray-50">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{strategyModal.script}</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-white">
              <button
                onClick={() => setStrategyModal(null)}
                className="w-full py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}