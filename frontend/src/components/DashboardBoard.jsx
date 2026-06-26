import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactDOM from 'react-dom';
import api from '../api';
import { PieChart, Pie, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';
import { AlertTriangle, Play, CheckCircle2, Clock, TrendingUp, Users, Target, X, Edit2, Sparkles, Zap, Award, Rocket, Loader2 } from 'lucide-react';

const segmentColors = {
  '重点唤醒': '#EF4444',
  '保持温度': '#F97316',
  '低优先唤醒': '#3B82F6',
  '沉睡观察': '#6B7280',
};

const stageColors = [
  '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#F97316', '#EAB308',
];

export default function DashboardBoard({ onGenerateStrategy, onEditCandidate, onViewCandidate }) {
  const { t } = useTranslation('common');
  const [stats, setStats] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailModal, setDetailModal] = useState(null);
  const [detailType, setDetailType] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const [detailList, setDetailList] = useState([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPage, setDetailPage] = useState(1);

  const segmentTranslations = useMemo(() => ({
    '重点唤醒': t('key_recall'),
    '保持温度': t('keep_warm'),
    '低优先唤醒': t('low_priority'),
    '沉睡观察': t('sleeping')
  }), [t]);

  const stageTranslations = useMemo(() => ({
    '简历初筛': t('resume_screening'),
    'HR初面已约': t('hr_interview_scheduled'),
    'HR初面已完成': t('hr_interview_completed'),
    '业务一面已完成': t('business_interview_1_completed'),
    '业务二面待安排': t('business_interview_2_pending'),
    '终面已完成': t('final_interview_completed'),
    'Offer审批中': t('offer_approval'),
    'Offer已发待回复': t('offer_sent'),
    '未面试': t('no_interview')
  }), [t]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [candidatesRes, statsRes] = await Promise.all([
        api.get('/candidates', { params: { page: 1, page_size: 200, sort_by: 'rfm_total', sort_order: 'desc' } }),
        api.get('/stats'),
      ]);
      setCandidates(candidatesRes.data.items);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const pieData = useMemo(() => {
    if (!stats?.segment_counts) return [];
    return Object.entries(stats.segment_counts).map(([name, value]) => ({
      name: segmentTranslations[name] || name,
      originalName: name,
      value,
      color: segmentColors[name],
    }));
  }, [stats, segmentTranslations]);

  const todoList = useMemo(() => {
    return candidates.filter(c => c.segment === '重点唤醒' || c.overdue_followup);
  }, [candidates]);

  const recommendedCandidates = useMemo(() => {
    const scored = candidates.map((c) => {
      let score = 0;
      score += c.intent_score * 20;
      score += (c.overdue_followup ? 30 : 0);
      if (c.segment === '重点唤醒') score += 25;
      else if (c.segment === '保持温度') score += 15;
      else if (c.segment === '低优先唤醒') score += 5;
      score += Math.max(0, 30 - c.last_contact_days);
      score += c.interact_count * 2;
      return { ...c, recommend_score: Math.round(score) };
    });
    return scored.sort((a, b) => b.recommend_score - a.recommend_score).slice(0, 5);
  }, [candidates]);

  const getRecReason = (c) => {
    const reasons = [];
    if (c.overdue_followup) reasons.push(t('post_interview_timeout'));
    if (c.segment === '重点唤醒') reasons.push(t('key_recall'));
    if (c.intent_score >= 4) reasons.push(t('high_intent'));
    if (c.last_contact_days > 14) reasons.push(t('long_no_contact'));
    if (c.interact_count >= 3) reasons.push(t('active_interaction'));
    return reasons.slice(0, 2);
  };

  const openDetailModal = (type, value) => {
    setDetailType({ type, value });
    setDetailPage(1);
    setDetailModal(true);
    fetchDetailList(type, value, 1);
  };

  const closeDetailModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setDetailModal(false);
      setDetailType(null);
      setIsClosing(false);
      setDetailList([]);
      setDetailTotal(0);
      setDetailPage(1);
    }, 300);
  };

  const handleDetailPageChange = (page) => {
    if (!detailType) return;
    setDetailPage(page);
    fetchDetailList(detailType.type, detailType.value, page);
  };

  useEffect(() => {
    if (detailModal) {
      document.body.style.overflow = 'hidden';
      const handleEsc = (e) => {
        if (e.key === 'Escape') closeDetailModal();
      };
      window.addEventListener('keydown', handleEsc);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleEsc);
      };
    }
  }, [detailModal]);

  const fetchDetailList = async (type, value, page = 1) => {
    setDetailLoading(true);
    try {
      const params = { page, page_size: 50, sort_by: 'rfm_total', sort_order: 'desc' };
      if (type === 'segment') {
        params.segment = value;
      } else if (type === 'stage') {
        params.stage = value;
      } else if (type === 'overdue') {
        params.overdue = true;
      } else if (type === 'todo') {
        params.segment = '重点唤醒';
      } else if (type === 'recommended') {
        params.segment = '重点唤醒';
      }
      const res = await api.get('/candidates', { params });
      let items = res.data.items;
      let total = res.data.total;
      
      if (type === 'todo') {
        const overdueRes = await api.get('/candidates', { params: { page: 1, page_size: 50, overdue: true, sort_by: 'rfm_total', sort_order: 'desc' } });
        const existingIds = new Set(items.map(c => c.id));
        for (const c of overdueRes.data.items) {
          if (!existingIds.has(c.id)) {
            items.push(c);
          }
        }
        total = Math.min(total + overdueRes.data.total, 500);
        items = items.slice(0, 50);
      }
      
      setDetailList(items);
      setDetailTotal(total);
    } catch (error) {
      console.error('Failed to fetch detail list:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const getDetailTitle = () => {
    if (!detailType) return t('detail');
    const { type, value } = detailType;
    switch (type) {
      case 'segment':
        return `${segmentTranslations[value] || value} ${t('candidates')}`;
      case 'stage':
        return `${stageTranslations[value] || value} ${t('candidates')}`;
      case 'todo':
        return t('todo_list');
      case 'all_candidates':
        return t('all_candidates');
      case 'overdue':
        return t('overdue_followup');
      case 'recommended':
        return t('recommended_candidates');
      default:
        return t('detail');
    }
  };

  const funnelData = useMemo(() => {
    if (!stats?.interview_stage_counts) return [];
    const correctOrder = [
      '简历初筛',
      'HR初面已约',
      'HR初面已完成',
      '业务一面已完成',
      '业务二面待安排',
      '终面已完成',
      'Offer审批中',
      'Offer已发待回复',
    ];
    const stages = correctOrder
      .filter((stage) => stats.interview_stage_counts[stage] !== undefined)
      .map((name, index) => ({
        name: stageTranslations[name] || name,
        originalName: name,
        value: stats.interview_stage_counts[name],
        color: stageColors[index % stageColors.length],
      }));
    const maxValue = Math.max(...stages.map((s) => s.value), 1);
    return stages.map((s, i) => {
      const ratio = s.value / maxValue;
      const width = Math.max(25, 100 * Math.pow(ratio, 0.6));
      const prevValue = i > 0 ? stages[i - 1].value : null;
      const conversionRate = prevValue !== null && prevValue > 0 ? ((s.value / prevValue) * 100).toFixed(1) : '100.0';
      return {
        ...s,
        width,
        index: i,
        conversionRate,
      };
    });
  }, [stats, stageTranslations]);

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
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translate3d(-20px, 0, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s cubic-bezier(0.32, 0.72, 0, 1);
          will-change: opacity;
        }
        @keyframes modalPop {
          0% {
            opacity: 0;
            transform: scale(0.92);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-modal-pop {
          animation: modalPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          will-change: transform, opacity;
        }
        @keyframes modalPopOut {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(0.92);
          }
        }
        .animate-modal-pop-out {
          animation: modalPopOut 0.3s cubic-bezier(0.4, 0, 1, 1) forwards;
          will-change: transform, opacity;
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        .animate-fade-out {
          animation: fadeOut 0.3s cubic-bezier(0.4, 0, 1, 1) forwards;
          will-change: opacity;
        }
      `}</style>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-red-200 transition-all duration-300"
          onClick={() => openDetailModal('todo')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">{t('today_todo')}</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{todoList.length}</p>
              <p className="mt-1 text-xs text-gray-400">{t('click_view_detail_arrow')}</p>
            </div>
            <div className="p-3 rounded-lg bg-red-100 group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>

        <div
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200 transition-all duration-300"
          onClick={() => openDetailModal('all_candidates')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">{t('total_candidates')}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{stats?.total_candidates || 0}</p>
              <p className="mt-1 text-xs text-gray-400">{t('click_view_detail_arrow')}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-100 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-orange-200 transition-all duration-300"
          onClick={() => openDetailModal('overdue')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">{t('overdue_followup')}</p>
              <p className="mt-1 text-2xl font-bold text-orange-600">{stats?.overdue_followup_total || 0}</p>
              <p className="mt-1 text-xs text-gray-400">{t('click_view_detail_arrow')}</p>
            </div>
            <div className="p-3 rounded-lg bg-orange-100 group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl shadow-lg p-0.5 hover:shadow-xl transition-shadow duration-300">
        <div className="bg-white rounded-[10px] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  {t('ai_recommendation')}
                  <span className="px-1.5 py-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-medium rounded-full">
                    TOP 5
                  </span>
                </h3>
                <p className="text-xs text-gray-500">{t('ai_recommendation_subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Zap className="w-3.5 h-3.5 text-yellow-500" />
              <span>{t('today_recommendation')}</span>
            </div>
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="py-8 text-center">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin mx-auto" />
              </div>
            ) : (
              recommendedCandidates.map((c, index) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-50/40 transition-all cursor-pointer group"
                  onClick={() => {
                    if (onViewCandidate) {
                      onViewCandidate(c);
                    }
                  }}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white' :
                    index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                    index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {index < 3 ? <Award className="w-4 h-4" /> : index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{c.name}</span>
                      {getRecReason(c).map((reason, i) => (
                        <span
                          key={i}
                          className={`px-1.5 py-0.5 text-xs rounded-full flex-shrink-0 ${
                            reason === '面后超时' ? 'bg-red-100 text-red-600' :
                            reason === '重点唤醒' ? 'bg-orange-100 text-orange-600' :
                            reason === '高意向' ? 'bg-green-100 text-green-600' :
                            reason === '久未联系' ? 'bg-blue-100 text-blue-600' :
                            'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                      <span className="truncate">{c.position || '-'}</span>
                      <span>·</span>
                      <span>{c.interview_stage || t('no_interview')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">{t('recommendation_score')}</p>
                      <p className="text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        {c.recommend_score}
                      </p>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onGenerateStrategy(c);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        <Rocket className="w-3 h-3" />
                        {t('follow_up')}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-indigo-100 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{t('rfm_distribution')}</h3>
            <span className="text-xs text-gray-500">{t('click_view_detail')}</span>
          </div>
          <div className="h-64">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ strokeWidth: 1, stroke: '#E5E7EB' }}
                    onClick={(data) => openDetailModal('segment', data.originalName || data.name)}
                    style={{ cursor: 'pointer' }}
                    animationBegin={0}
                    animationDuration={800}
                    isAnimationActive={true}
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        className="transition-all duration-300 hover:opacity-80"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {Object.entries(segmentColors).map(([name, color]) => (
              <div
                key={name}
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-all duration-200 hover:scale-[1.02]"
                onClick={() => openDetailModal('segment', name)}
              >
                <div
                  className="w-3 h-3 rounded-full transition-transform duration-200 hover:scale-125"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-gray-600">{segmentTranslations[name] || name}</span>
                <span className="text-xs font-semibold text-gray-900 ml-auto">
                  {stats?.segment_counts?.[name] || 0}{t('people')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-purple-100 transition-all duration-300">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-gray-900">{t('funnel')}</h3>
            <span className="text-xs text-gray-500">{t('click_view_detail')}</span>
          </div>
          <div>
            {loading ? (
              <div className="h-40 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-1">
                {funnelData.map((item, index) => (
                  <div key={item.name}>
                    <div
                      className="group cursor-pointer flex items-center gap-3"
                      onClick={() => openDetailModal('stage', item.name)}
                      style={{
                        animation: `slideIn 0.5s ease-out ${index * 0.08}s both`,
                      }}
                    >
                      <div className="w-24 flex-shrink-0 text-right">
                        <span className="text-xs font-medium text-gray-700">{item.name}</span>
                      </div>
                      <div className="flex-1 flex justify-center">
                        <div
                          className="h-9 rounded-md flex items-center justify-center transition-all duration-300 group-hover:brightness-105 group-hover:scale-[1.02] group-hover:shadow-lg relative overflow-hidden"
                          style={{
                            width: `${item.width}%`,
                            backgroundColor: item.color,
                            minWidth: '80px',
                            boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.1)',
                          }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                          <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
                          <span className="text-white font-semibold text-sm relative z-10 drop-shadow-sm">{item.value}人</span>
                        </div>
                      </div>
                    </div>
                    {index < funnelData.length - 1 && (
                      <div className="flex items-center gap-3 h-6 -my-1">
                        <div className="w-24 flex-shrink-0" />
                        <div className="flex-1 flex justify-center items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-px h-2 bg-gray-300" />
                            <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                              {funnelData[index + 1].conversionRate}%
                            </span>
                            <div className="w-px h-2 bg-gray-300" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="flex flex-wrap gap-1.5">
              {funnelData.map((item) => (
                <span
                  key={item.name}
                  className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full cursor-pointer hover:bg-gray-200 hover:scale-105 transition-all duration-200"
                  onClick={() => openDetailModal('stage', item.name)}
                >
                  {item.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-red-100 transition-all duration-300">
        <div
          className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-red-50 to-orange-50 cursor-pointer hover:bg-gradient-to-r hover:from-red-100/50 hover:to-orange-100/50 transition-colors"
          onClick={() => openDetailModal('todo')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Target className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{t('todo_list')}</h3>
              <p className="text-xs text-gray-500">{t('key_recall')} + {t('overdue_followup')}</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
            {todoList.length} {t('pending_items')}
          </span>
        </div>

        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto" />
            </div>
          ) : todoList.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-500">{t('no_todo_candidates')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('all_candidates_good')}</p>
            </div>
          ) : (
            todoList.slice(0, 5).map((candidate) => (
              <div key={candidate.id} className="px-5 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                <div
                  className="flex items-center gap-4 flex-1 cursor-pointer"
                  onClick={() => openDetailModal('todo')}
                >
                  <div className={`w-3 h-3 rounded-full ${candidate.segment === '重点唤醒' ? 'bg-red-500' : 'bg-orange-500'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{candidate.name}</span>
                      {candidate.overdue_followup && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                          <AlertTriangle className="w-3 h-3" />
                          {t('post_interview_timeout')}
                        </span>
                      )}
                      {candidate.segment === '重点唤醒' && !candidate.overdue_followup && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                          <TrendingUp className="w-3 h-3" />
                          {t('key_recall')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{candidate.position}</span>
                      <span>·</span>
                      <span>{candidate.city || '-'}</span>
                      <span>·</span>
                      <span>{candidate.interview_stage || t('no_interview')}</span>
                      <span>·</span>
                      <span>{t('recent_contact')} {candidate.last_contact_days} {t('days')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onEditCandidate) onEditCandidate(candidate);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    {t('edit')}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onGenerateStrategy(candidate);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {t('one_click_strategy')}
                  </button>
                </div>
              </div>
            ))
          )}
          {todoList.length > 5 && (
            <div
              className="px-5 py-3 text-center text-xs text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => openDetailModal('todo')}
            >
              {t('view_all')} {todoList.length} {t('items')} →
            </div>
          )}
        </div>
      </div>

      {detailModal && ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className={`fixed inset-0 bg-black/10 backdrop-blur-md ${isClosing ? 'animate-fade-out' : ''}`}
            onClick={closeDetailModal}
          />
          <div
            className={`relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col my-4 mx-auto ${isClosing ? 'animate-modal-pop-out' : 'animate-modal-pop'}`}
            style={{ width: 'calc(100% - 32px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900">{getDetailTitle()}</h3>
                <span className="text-sm text-gray-500">
                  {t('total')} {detailTotal} {t('person')}
                </span>
              </div>
              <button onClick={closeDetailModal} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">{t('name')}</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">{t('position')}</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">{t('city')}</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">{t('interview_stage')}</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">{t('recent_contact')}</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">{t('intent_score')}</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">{t('rfm_segment')}</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">{t('operation')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detailLoading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center">
                          <Loader2 className="w-5 h-5 text-gray-400 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : detailList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          {t('no_data')}
                        </td>
                      </tr>
                    ) : (
                      detailList.map((c) => (
                        <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${c.overdue_followup ? 'bg-red-50/30' : ''}`}>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 text-sm">{c.name}</span>
                              {c.overdue_followup && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  {t('timeout')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{c.position || '-'}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{c.city || '-'}</td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{c.interview_stage || t('no_interview')}</span>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{c.last_contact_days} {t('days')}</td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <div className="flex">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <div
                                    key={star}
                                    className={`w-2.5 h-2.5 rounded-full ${star <= c.intent_score ? 'bg-yellow-400' : 'bg-gray-200'}`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs text-gray-500">{c.intent_score}/5</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                                c.segment === '重点唤醒'
                                  ? 'bg-red-100 text-red-700 border-red-200'
                                  : c.segment === '保持温度'
                                  ? 'bg-orange-100 text-orange-700 border-orange-200'
                                  : c.segment === '低优先唤醒'
                                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                              }`}
                            >
                              {segmentTranslations[c.segment] || c.segment}
                            </span>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  closeDetailModal();
                                  if (onEditCandidate) onEditCandidate(c);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                <Edit2 className="w-3 h-3" />
                                {t('edit')}
                              </button>
                              <button
                                onClick={() => {
                                  closeDetailModal();
                                  onGenerateStrategy(c);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                              >
                                <Play className="w-3 h-3" />
                                {t('strategy')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {detailTotal > 50 && (
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="text-sm text-gray-500">
                  {t('total_items', { total: detailTotal, page: detailPage, totalPages: Math.ceil(detailTotal / 50) })}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDetailPageChange(1)}
                    disabled={detailPage === 1}
                    className="px-2 py-1 text-sm rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('home')}
                  </button>
                  <button
                    onClick={() => handleDetailPageChange(Math.max(1, detailPage - 1))}
                    disabled={detailPage === 1}
                    className="px-3 py-1 text-sm rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('prev_page')}
                  </button>
                  <div className="flex items-center gap-1 mx-2">
                    {Array.from(
                      { length: Math.min(5, Math.ceil(detailTotal / 50)) },
                      (_, i) => {
                        const totalPages = Math.ceil(detailTotal / 50);
                        let startPage = Math.max(1, detailPage - 2);
                        let endPage = Math.min(totalPages, startPage + 4);
                        if (endPage - startPage < 4) {
                          startPage = Math.max(1, endPage - 4);
                        }
                        const page = startPage + i;
                        if (page > endPage) return null;
                        return (
                          <button
                            key={page}
                            onClick={() => handleDetailPageChange(page)}
                            className={`w-8 h-8 text-sm rounded-md transition-colors ${
                              page === detailPage
                                ? "bg-blue-600 text-white font-medium"
                                : "hover:bg-gray-100 text-gray-700"
                            }`}
                          >
                            {page}
                          </button>
                        );
                      },
                    )}
                  </div>
                  <button
                    onClick={() => handleDetailPageChange(Math.min(Math.ceil(detailTotal / 50), detailPage + 1))}
                    disabled={detailPage >= Math.ceil(detailTotal / 50)}
                    className="px-3 py-1 text-sm rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('next_page')}
                  </button>
                  <button
                    onClick={() => handleDetailPageChange(Math.ceil(detailTotal / 50))}
                    disabled={detailPage >= Math.ceil(detailTotal / 50)}
                    className="px-2 py-1 text-sm rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('last_page')}
                  </button>
                </div>
              </div>
            )}

            <div className="px-5 py-4 border-t border-gray-100 bg-white">
              <button
                onClick={closeDetailModal}
                className="w-full py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
