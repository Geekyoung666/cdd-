import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from 'react-i18next';
import api from "../api";
import {
  Users,
  AlertTriangle,
  Thermometer,
  Target,
  Upload,
  Play,
  Loader2,
  AlertCircle,
  X,
  Copy,
  Check,
  User,
  Mail,
  Phone,
  Briefcase,
  Clock,
  Star,
  MessageSquare,
  LayoutDashboard,
  ClipboardList,
  Plus,
  Edit2,
  Save,
  XCircle,
  Search,
  ArrowUpDown,
  Sparkles,
  Zap,
  MapPin,
  Building,
  DollarSign,
  FileText,
} from "lucide-react";
import DashboardBoard from "./DashboardBoard";

const INTERVIEW_STAGES = [
  "简历初筛",
  "HR初面已约",
  "HR初面已完成",
  "业务一面已完成",
  "业务二面待安排",
  "终面已完成",
  "Offer审批中",
  "Offer已发待回复",
];

const IntentOptions = [1, 2, 3, 4, 5];
const STRATEGY_CONFIG_STORAGE_KEY = "strategy_llm_config";
const STRATEGY_PROVIDERS = ["openai", "deepseek", "claude", "gemini"];

function readStoredStrategyConfig() {
  if (typeof window === "undefined") {
    return {
      provider: "openai",
      apiKey: "",
      baseUrl: "",
      model: "",
    };
  }

  try {
    const raw = window.localStorage.getItem(STRATEGY_CONFIG_STORAGE_KEY);
    if (!raw) {
      return {
        provider: "openai",
        apiKey: "",
        baseUrl: "",
        model: "",
      };
    }
    const parsed = JSON.parse(raw);
    return {
      provider: parsed.provider || "openai",
      apiKey: parsed.apiKey || "",
      baseUrl: parsed.baseUrl || "",
      model: parsed.model || "",
    };
  } catch (error) {
    return {
      provider: "openai",
      apiKey: "",
      baseUrl: "",
      model: "",
    };
  }
}

const SegmentTag = ({ segment }) => {
  const { t } = useTranslation('common');
  const styles = {
    重点唤醒: "bg-red-100 text-red-700 border-red-200",
    保持温度: "bg-orange-100 text-orange-700 border-orange-200",
    低优先唤醒: "bg-blue-100 text-blue-700 border-blue-200",
    沉睡观察: "bg-gray-100 text-gray-600 border-gray-200",
  };
  const translations = {
    '重点唤醒': t('key_recall'),
    '保持温度': t('keep_warm'),
    '低优先唤醒': t('low_priority'),
    '沉睡观察': t('sleeping')
  };
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[segment] || styles["沉睡观察"]}`}
    >
      {translations[segment] || segment}
    </span>
  );
};

const StatCard = ({
  icon: Icon,
  title,
  value,
  subtitle,
  highlight,
  onClick,
}) => (
  <div
    className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 ${highlight ? "border-red-200 bg-red-50/50" : ""} ${onClick ? "cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all" : ""}`}
    onClick={onClick}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p
          className={`mt-1 text-2xl font-bold ${highlight ? "text-red-600" : "text-gray-900"}`}
        >
          {value}
        </p>
        {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
      </div>
      <div
        className={`p-3 rounded-lg ${highlight ? "bg-red-100" : "bg-gray-100"}`}
      >
        <Icon
          className={`w-5 h-5 ${highlight ? "text-red-600" : "text-gray-500"}`}
        />
      </div>
    </div>
  </div>
);

export default function Dashboard({ onLogout, onLanguageChange, currentLang }) {
  const { t } = useTranslation('common');
  const [candidates, setCandidates] = useState([]);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [strategyModal, setStrategyModal] = useState(null);
  const [activeTab, setActiveTab] = useState("list");
  const [formModal, setFormModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [detailList, setDetailList] = useState([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailPage, setDetailPage] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);
  const [closingState, setClosingState] = useState({
    strategy: false,
    form: false,
    detail: false,
    drawer: false,
  });
  const [searchQuery, setSearchQuery] = useState("");

  const stageTranslations = useMemo(() => ({
    '简历初筛': t('resume_screening'),
    'HR初面已约': t('hr_interview_scheduled'),
    'HR初面已完成': t('hr_interview_completed'),
    '业务一面已完成': t('business_interview_1_completed'),
    '业务二面待安排': t('business_interview_2_pending'),
    '终面已完成': t('final_interview_completed'),
    'Offer审批中': t('offer_approval'),
    'Offer已发待回复': t('offer_pending_reply')
  }), [t]);
  const segmentTranslations = useMemo(() => ({
    '重点唤醒': t('key_recall'),
    '保持温度': t('keep_warm'),
    '低优先唤醒': t('low_priority'),
    '沉睡观察': t('sleeping')
  }), [t]);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterSegment, setFilterSegment] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterIntent, setFilterIntent] = useState("");
  const [sortBy, setSortBy] = useState("last_contact_days");
  const [sortOrder, setSortOrder] = useState("asc");
  const [tabSliderStyle, setTabSliderStyle] = useState({ left: 0, width: 0 });
  const listTabRef = useRef(null);
  const boardTabRef = useRef(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    position: "",
    industry: "",
    city: "",
    channel: "",
    interview_stage: "",
    last_contact_date: "",
    interact_count: 0,
    intent_score: 1,
    current_salary_k: "",
    expect_salary_k: "",
    note: "",
  });
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);
  const [strategyConfig, setStrategyConfig] = useState(readStoredStrategyConfig);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      STRATEGY_CONFIG_STORAGE_KEY,
      JSON.stringify(strategyConfig),
    );
  }, [strategyConfig]);

  const openFormModal = (candidate = null) => {
    if (candidate) {
      setFormData({
        name: candidate.name || "",
        position: candidate.position || "",
        industry: candidate.industry || "",
        city: candidate.city || "",
        channel: candidate.channel || "",
        interview_stage: candidate.interview_stage || "",
        last_contact_date: candidate.last_contact_date || "",
        interact_count: candidate.interact_count || 0,
        intent_score: candidate.intent_score || 1,
        current_salary_k: candidate.current_salary_k || "",
        expect_salary_k: candidate.expect_salary_k || "",
        note: candidate.note || "",
      });
    } else {
      setFormData({
        name: "",
        position: "",
        industry: "",
        city: "",
        channel: "",
        interview_stage: "",
        last_contact_date: "",
        interact_count: 0,
        intent_score: 1,
        current_salary_k: "",
        expect_salary_k: "",
        note: "",
      });
    }
    setFormModal(candidate ? candidate.id : "new");
  };

  const closeFormModal = () => {
    setClosingState((prev) => ({ ...prev, form: true }));
    setTimeout(() => {
      setFormModal(null);
      setFormData({
        name: "",
        position: "",
        industry: "",
        city: "",
        channel: "",
        interview_stage: "",
        last_contact_date: "",
        interact_count: 0,
        intent_score: 1,
        current_salary_k: "",
        expect_salary_k: "",
        note: "",
      });
      setClosingState((prev) => ({ ...prev, form: false }));
    }, 300);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.position.trim()) {
      showToast(t('name_and_position_required'));
      return;
    }

    const submitData = {
      ...formData,
      interact_count: parseInt(formData.interact_count) || 0,
      intent_score: parseInt(formData.intent_score) || 1,
      current_salary_k: formData.current_salary_k
        ? parseInt(formData.current_salary_k)
        : null,
      expect_salary_k: formData.expect_salary_k
        ? parseInt(formData.expect_salary_k)
        : null,
    };

    try {
      if (formModal !== "new") {
        await api.put(`/candidates/${formModal}`, submitData);
        showToast(t('updated'));
      } else {
        await api.post("/candidates", submitData);
        showToast(t('added'));
      }
      fetchData();
      closeFormModal();
    } catch (error) {
      console.error("Submit failed:", error);
      showToast(t('operation_failed'));
    }
  };

  useEffect(() => {
    fetchData();
    requestAnimationFrame(updateTabSlider);
  }, []);

  const updateTabSlider = useCallback(() => {
    const activeRef =
      activeTab === "list" ? listTabRef.current : boardTabRef.current;
    if (activeRef) {
      const rect = activeRef.getBoundingClientRect();
      const parentRect = activeRef.parentElement?.getBoundingClientRect();
      if (parentRect) {
        setTabSliderStyle({
          left: rect.left - parentRect.left,
          width: rect.width,
        });
      }
    }
  }, [activeTab]);

  useEffect(() => {
    requestAnimationFrame(updateTabSlider);
  }, [activeTab, updateTabSlider]);

  useEffect(() => {
    window.addEventListener("resize", updateTabSlider);
    return () => window.removeEventListener("resize", updateTabSlider);
  }, [updateTabSlider]);

  useEffect(() => {
    if (activeTab === "list") {
      fetchCandidates();
    }
  }, [
    currentPage,
    debouncedSearch,
    filterSegment,
    filterStage,
    filterIntent,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleFilterChange = (setter, value) => {
    setCurrentPage(1);
    setter(value);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        fetchCandidatesList(),
        api.get("/stats"),
      ]);
      setCandidates(listRes.items);
      setTotalCandidates(listRes.total);
      setStats(statsRes.data);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidatesList = async () => {
    const params = {
      page: currentPage,
      page_size: pageSize,
      search: debouncedSearch,
      segment: filterSegment,
      stage: filterStage,
      intent: parseInt(filterIntent) || 0,
      sort_by: sortBy,
      sort_order: sortOrder,
    };
    const res = await api.get("/candidates", { params });
    return res.data;
  };

  const fetchCandidates = async () => {
    setListLoading(true);
    try {
      const data = await fetchCandidatesList();
      setCandidates(data.items);
      setTotalCandidates(data.total);
    } catch (error) {
      console.error("Failed to fetch candidates:", error);
    } finally {
      setListLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      await api.post("/candidates/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      fetchData();
    } catch (error) {
      console.error("Import failed:", error);
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const [strategyLoading, setStrategyLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const updateStrategyConfig = (field, value) => {
    setStrategyConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const buildStrategyPayload = () => {
    const payload = {
      provider: strategyConfig.provider?.trim(),
      apiKey: strategyConfig.apiKey?.trim(),
      baseUrl: strategyConfig.baseUrl?.trim(),
      model: strategyConfig.model?.trim(),
    };

    return Object.fromEntries(
      Object.entries(payload).filter(([, value]) => Boolean(value)),
    );
  };

  const requestStrategy = async (candidate) => {
    setStrategyLoading(true);
    setStrategyModal({ candidate });
    try {
      const res = await api.post(
        `/candidates/${candidate.id}/strategy`,
        buildStrategyPayload(),
      );
      setStrategyModal({
        candidate,
        ...res.data,
      });
    } catch (error) {
      console.error("Generate strategy failed:", error);
      setStrategyModal({
        candidate,
        status: "error",
        error:
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          "生成策略失败，请稍后重试",
      });
    } finally {
      setStrategyLoading(false);
    }
  };

  const closeStrategyModal = () => {
    setClosingState((prev) => ({ ...prev, strategy: true }));
    setTimeout(() => {
      setStrategyModal(null);
      setCopied(false);
      setClosingState((prev) => ({ ...prev, strategy: false }));
    }, 300);
  };

  const handleGenerateStrategy = async (candidate) => {
    setStrategyModal({ candidate });
    if (!strategyConfig.apiKey?.trim()) {
      return;
    }
    await requestStrategy(candidate);
  };

  const getSegmentCount = (segment) => {
    return stats?.segment_counts?.[segment] || 0;
  };

  const handleSort = (field) => {
    setCurrentPage(1);
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const openDetailModal = (type) => {
    setDetailModal(type);
    setDetailPage(1);
    fetchDetailList(type, 1);
  };

  const closeDetailModal = () => {
    setClosingState((prev) => ({ ...prev, detail: true }));
    setTimeout(() => {
      setDetailModal(null);
      setClosingState((prev) => ({ ...prev, detail: false }));
    }, 300);
  };

  const fetchDetailList = async (type, page = 1) => {
    setDetailLoading(true);
    try {
      const params = { page, page_size: 50 };

      switch (type) {
        case "key_wakeup":
          params.segment = "重点唤醒";
          break;
        case "overdue":
          params.overdue = true;
          break;
        case "intent":
          params.sort_by = "intent_score";
          params.sort_order = "desc";
          break;
        default:
          break;
      }

      const res = await api.get("/candidates", { params });
      setDetailList(res.data.items);
      setDetailTotal(res.data.total);
    } catch (error) {
      console.error("Failed to fetch detail list:", error);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (detailModal) {
      fetchDetailList(detailModal, detailPage);
    }
  }, [detailPage]);

  const getDetailTitle = () => {
    switch (detailModal) {
      case "all":
        return t('all_candidates');
      case "key_wakeup":
        return t('key_wakeup_candidates');
      case "overdue":
        return t('overdue_followup');
      case "intent":
        return t('intent_distribution');
      default:
        return t('detail');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm isolate">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {t('title')}
              </h1>
              <p className="text-xs text-gray-500">{t('subtitle')} {t('author')}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onLanguageChange(currentLang === 'zh' ? 'en' : 'zh')}
                className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                {currentLang === 'zh' ? 'EN' : '中文'}
              </button>
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Users className="w-4 h-4" />
                {t('logout')}
              </button>
              <button
                onClick={() => openFormModal()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('add_candidate')}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {t('import_csv')}
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
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="relative inline-flex items-center bg-gray-100 rounded-lg p-1 z-0">
            <div
              className="absolute top-1 bottom-1 rounded-md bg-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
              style={{
                left: tabSliderStyle.left,
                width: tabSliderStyle.width,
              }}
            />
            <button
              ref={listTabRef}
              onClick={() => setActiveTab("list")}
              className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "list" ? "text-gray-900" : "text-gray-600 hover:text-gray-900"}`}
            >
              <ClipboardList className="w-4 h-4" />
              {t('candidate_list')}
            </button>
            <button
              ref={boardTabRef}
              onClick={() => setActiveTab("board")}
              className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "board" ? "text-gray-900" : "text-gray-600 hover:text-gray-900"}`}
            >
              <LayoutDashboard className="w-4 h-4" />
              {t('recall_board')}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {t('import_candidates')}
            </button>
          </div>
        </div>

        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
            style={{
              width: "200%",
              transform:
                activeTab === "list" ? "translateX(0)" : "translateX(-50%)",
            }}
          >
            <div className="w-1/2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                  icon={Users}
                  title={t('total_candidates')}
                  value={stats?.total_candidates || 0}
                  subtitle={t('click_view_all')}
                  onClick={() => openDetailModal("all")}
                />
                <StatCard
                  icon={AlertTriangle}
                  title={t('key_recall')}
                  value={getSegmentCount("重点唤醒")}
                  subtitle={t('click_view_detail')}
                  highlight
                  onClick={() => openDetailModal("key_wakeup")}
                />
                <StatCard
                  icon={Thermometer}
                  title={t('overdue_followup')}
                  value={stats?.overdue_followup_total || 0}
                  subtitle={t('click_view_detail')}
                  highlight
                  onClick={() => openDetailModal("overdue")}
                />
                <StatCard
                  icon={Target}
                  title={t('average_intent')}
                  value={stats?.average_intent_score || 0}
                  subtitle={t('click_view_distribution')}
                  onClick={() => openDetailModal("intent")}
                />
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-sm font-semibold text-gray-900">
                        {t('candidate_list')}
                      </h2>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                        {candidates.length} / {totalCandidates} {t('person')}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col lg:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('search_placeholder')}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <select
                        value={filterSegment}
                        onChange={(e) =>
                          handleFilterChange(setFilterSegment, e.target.value)
                        }
                        className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                      >
                        <option value="">{t('all_segments')}</option>
                        <option value="重点唤醒">{t('key_recall')}</option>
                        <option value="保持温度">{t('keep_warm')}</option>
                        <option value="低优先唤醒">{t('low_priority')}</option>
                        <option value="沉睡观察">{t('sleeping')}</option>
                      </select>

                      <select
                        value={filterStage}
                        onChange={(e) =>
                          handleFilterChange(setFilterStage, e.target.value)
                        }
                        className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                      >
                        <option value="">{t('all_stages')}</option>
                        {INTERVIEW_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {stageTranslations[s] || s}
                          </option>
                        ))}
                      </select>

                      <select
                        value={filterIntent}
                        onChange={(e) =>
                          handleFilterChange(setFilterIntent, e.target.value)
                        }
                        className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                      >
                        <option value="">{t('all_intent')}</option>
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n} {currentLang === 'zh' ? '星' : 'stars'}
                          </option>
                        ))}
                      </select>

                      <select
                        value={`${sortBy}-${sortOrder}`}
                        onChange={(e) => {
                          const [by, order] = e.target.value.split("-");
                          setCurrentPage(1);
                          setSortBy(by);
                          setSortOrder(order);
                        }}
                        className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                      >
                        <option value="last_contact_days-asc">
                          {t('recent_contact')} {t('asc_arrow')}
                        </option>
                        <option value="last_contact_days-desc">
                          {t('recent_contact')} {t('desc_arrow')}
                        </option>
                        <option value="intent_score-desc">{t('intent_score')} {t('desc_arrow')}</option>
                        <option value="intent_score-asc">{t('intent_score')} {t('asc_arrow')}</option>
                        <option value="interact_count-desc">{t('interaction_count')} {t('desc_arrow')}</option>
                        <option value="interact_count-asc">{t('interaction_count')} {t('asc_arrow')}</option>
                      </select>

                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setCurrentPage(1);
                          setPageSize(parseInt(e.target.value));
                        }}
                        className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                      >
                        <option value={50}>50 {t('items_per_page')}</option>
                        <option value={100}>100 {t('items_per_page')}</option>
                        <option value={200}>200 {t('items_per_page')}</option>
                        <option value={500}>500 {t('items_per_page')}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">
                          {t('name')}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">
                          {t('position')}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">
                          {t('city')}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">
                          {t('interview_stage')}
                        </th>
                        <th
                          className="px-4 py-3 text-left text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors select-none whitespace-nowrap"
                          onClick={() => handleSort("last_contact_days")}
                        >
                          <div className="flex items-center gap-1">
                            {t('recent_contact')}
                            {sortBy === "last_contact_days" && (
                              <ArrowUpDown
                                className={`w-4 h-4 transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`}
                              />
                            )}
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 text-left text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors select-none whitespace-nowrap"
                          onClick={() => handleSort("intent_score")}
                        >
                          <div className="flex items-center gap-1">
                            {t('intent_score')}
                            {sortBy === "intent_score" && (
                              <ArrowUpDown
                                className={`w-4 h-4 transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`}
                              />
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">
                          {t('rfm_segment')}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">
                          {t('operation')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loading || listLoading ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center">
                            <Loader2 className="w-6 h-6 text-gray-400 animate-spin mx-auto" />
                          </td>
                        </tr>
                      ) : candidates.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center">
                            <div className="text-gray-400 mb-2">
                              <Search className="w-10 h-10 mx-auto opacity-50" />
                            </div>
                            <p className="text-gray-500">
                              {t('no_results')}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {t('adjust_filters')}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        candidates.map((c) => (
                          <tr
                            key={c.id}
                            className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${c.overdue_followup ? "bg-red-50/30" : ""}`}
                            onClick={() => setSelectedCandidate(c)}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                                  {c.name.charAt(0)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900">
                                      {c.name}
                                    </span>
                                    {c.overdue_followup && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                                        <AlertCircle className="w-3 h-3" />
                                        {t('post_interview_timeout')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                              {c.position || "-"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                              {c.city || "-"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                {c.interview_stage || t('no_interview')}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                              {c.last_contact_days} {t('days')}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <div className="flex">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <div
                                      key={star}
                                      className={`w-3 h-3 rounded-full ${star <= c.intent_score ? "bg-yellow-400" : "bg-gray-200"}`}
                                    />
                                  ))}
                                </div>
                                <span className="text-xs text-gray-500 ml-1">
                                  {c.intent_score}/5
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <SegmentTag segment={c.segment} />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGenerateStrategy(c);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                  {t('generate_strategy')}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openFormModal(c);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  {t('edit')}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {totalCandidates > pageSize && (
                  <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="text-sm text-gray-500">
                      {t('total_items', { total: totalCandidates, page: currentPage, totalPages: Math.ceil(totalCandidates / pageSize) })}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="px-2 py-1 text-sm rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {t('home')}
                      </button>
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {t('prev_page')}
                      </button>
                      <div className="flex items-center gap-1 mx-2">
                        {Array.from(
                          {
                            length: Math.min(
                              5,
                              Math.ceil(totalCandidates / pageSize),
                            ),
                          },
                          (_, i) => {
                            const totalPages = Math.ceil(
                              totalCandidates / pageSize,
                            );
                            let startPage = Math.max(1, currentPage - 2);
                            let endPage = Math.min(totalPages, startPage + 4);
                            if (endPage - startPage < 4) {
                              startPage = Math.max(1, endPage - 4);
                            }
                            const page = startPage + i;
                            if (page > endPage) return null;
                            return (
                              <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`w-8 h-8 text-sm rounded-md transition-colors ${
                                  page === currentPage
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
                        onClick={() =>
                          setCurrentPage((p) =>
                            Math.min(
                              Math.ceil(totalCandidates / pageSize),
                              p + 1,
                            ),
                          )
                        }
                        disabled={
                          currentPage >= Math.ceil(totalCandidates / pageSize)
                        }
                        className="px-3 py-1 text-sm rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {t('next_page')}
                      </button>
                      <button
                        onClick={() =>
                          setCurrentPage(Math.ceil(totalCandidates / pageSize))
                        }
                        disabled={
                          currentPage >= Math.ceil(totalCandidates / pageSize)
                        }
                        className="px-2 py-1 text-sm rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {t('last_page')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="w-1/2">
              <DashboardBoard
                onGenerateStrategy={handleGenerateStrategy}
                onEditCandidate={openFormModal}
                onViewCandidate={(candidate) => {
                  setActiveTab("list");
                  setSelectedCandidate(candidate);
                }}
                currentLang={currentLang}
              />
            </div>
          </div>
        </div>
      </main>

      {strategyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className={`fixed inset-0 bg-black/10 backdrop-blur-md ${closingState.strategy ? "animate-fade-out" : ""}`}
            onClick={closeStrategyModal}
          />
          <div
            className={`relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col m-4 ${closingState.strategy ? "animate-modal-pop-out" : "animate-modal-pop"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-blue-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {strategyModal.candidate.name} {t('strategy')}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">
                      {strategyModal.candidate.position}
                    </span>
                    <SegmentTag segment={strategyModal.candidate.segment} />
                  </div>
                </div>
              </div>
              <button
                onClick={closeStrategyModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2 text-gray-600">
                  <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                  <span>
                    {strategyModal.candidate.interview_stage || t('no_interview')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>
                    {t('recent_contact')} {strategyModal.candidate.last_contact_days} {t('days')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Star className="w-3.5 h-3.5 text-yellow-400" />
                  <span>{t('intent_score')} {strategyModal.candidate.intent_score}/5</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                  <span>
                    {strategyModal.candidate.overdue_followup
                      ? t('post_interview_timeout')
                      : t('follow_up')}
                  </span>
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
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      {t("llm_settings")}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {t("llm_settings_hint")}
                    </p>
                  </div>
                  {(strategyModal.provider || strategyModal.model) && (
                    <span className="text-xs text-slate-500">
                      {strategyModal.provider || strategyConfig.provider}
                      {strategyModal.model ? ` / ${strategyModal.model}` : ""}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">
                      {t("provider")}
                    </span>
                    <select
                      value={strategyConfig.provider}
                      onChange={(e) =>
                        updateStrategyConfig("provider", e.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    >
                      {STRATEGY_PROVIDERS.map((provider) => (
                        <option key={provider} value={provider}>
                          {provider}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">
                      {t("model")}
                    </span>
                    <input
                      value={strategyConfig.model}
                      onChange={(e) =>
                        updateStrategyConfig("model", e.target.value)
                      }
                      placeholder={t("model_placeholder")}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </label>

                  <label className="block col-span-2">
                    <span className="text-xs font-medium text-slate-600">
                      {t("api_key")}
                    </span>
                    <input
                      type="password"
                      value={strategyConfig.apiKey}
                      onChange={(e) =>
                        updateStrategyConfig("apiKey", e.target.value)
                      }
                      placeholder={t("api_key_placeholder")}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </label>

                  <label className="block col-span-2">
                    <span className="text-xs font-medium text-slate-600">
                      {t("base_url")}
                    </span>
                    <input
                      value={strategyConfig.baseUrl}
                      onChange={(e) =>
                        updateStrategyConfig("baseUrl", e.target.value)
                      }
                      placeholder={t("base_url_placeholder")}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </label>
                </div>

                <button
                  onClick={() => requestStrategy(strategyModal.candidate)}
                  disabled={strategyLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                >
                  {strategyLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {strategyModal.script || strategyModal.risk_judgement
                    ? t("regenerate_strategy")
                    : t("generate_strategy_now")}
                </button>
              </div>

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
              ) : strategyModal.status === "error" ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center gap-2 text-red-600 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">{t('generated_failed')}</span>
                  </div>
                  <p className="text-sm text-red-700">{strategyModal.error}</p>
                  <p className="text-xs text-red-500 mt-2">
                    {t('llm_error_hint')}
                  </p>
                </div>
              ) : !strategyModal.risk_judgement ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    {t("llm_empty_state")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("llm_empty_state_hint")}
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {t('risk_judgement')}
                      </label>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {strategyModal.risk_judgement}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {t('recommended_channel')}
                      </label>
                      <p className="mt-2 text-lg font-semibold text-blue-600">
                        {strategyModal.channel}
                      </p>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {t('recommended_timing')}
                      </label>
                      <p className="mt-2 text-lg font-semibold text-green-600">
                        {strategyModal.timing}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {t('recall_script')}
                        </label>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              strategyModal.script,
                            );
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          } catch (e) {
                            const textarea = document.createElement("textarea");
                            textarea.value = strategyModal.script;
                            document.body.appendChild(textarea);
                            textarea.select();
                            document.execCommand("copy");
                            document.body.removeChild(textarea);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${copied ? "bg-green-50 border border-green-200 text-green-600" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"}`}
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copied ? t('copied') : t('copy_script')}
                      </button>
                    </div>
                    <div className="p-4 bg-gray-50">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {strategyModal.script}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-white">
              <div className="flex gap-3">
                <button
                  onClick={closeStrategyModal}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  {t('close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {formModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className={`fixed inset-0 bg-black/10 backdrop-blur-md ${closingState.form ? "animate-fade-out" : ""}`}
            onClick={closeFormModal}
          />
          <div
            className={`relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden m-4 ${closingState.form ? "animate-modal-pop-out" : "animate-modal-pop"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {formModal !== "new" ? t('edit_candidate') : t('add_candidate')}
              </h3>
              <button
                onClick={closeFormModal}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    姓名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="请输入姓名"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    岗位 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) =>
                      setFormData({ ...formData, position: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="请输入岗位"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    行业
                  </label>
                  <input
                    type="text"
                    value={formData.industry}
                    onChange={(e) =>
                      setFormData({ ...formData, industry: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="请输入行业"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    城市
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="请输入城市"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    来源渠道
                  </label>
                  <input
                    type="text"
                    value={formData.channel}
                    onChange={(e) =>
                      setFormData({ ...formData, channel: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="如：BOSS直聘"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('interview_stage')}
                  </label>
                  <select
                    value={formData.interview_stage}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        interview_stage: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="">{t('please_select')}</option>
                    {INTERVIEW_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stageTranslations[stage] || stage}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('last_contact')}
                  </label>
                  <input
                    type="date"
                    value={formData.last_contact_date}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        last_contact_date: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('interaction_count')}
                  </label>
                  <input
                    type="number"
                    value={formData.interact_count}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        interact_count: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('intent_score')}
                  </label>
                  <select
                    value={formData.intent_score}
                    onChange={(e) =>
                      setFormData({ ...formData, intent_score: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    {IntentOptions.map((option) => (
                      <option key={option} value={option}>
                        {option} 星
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    当前薪资(k)
                  </label>
                  <input
                    type="number"
                    value={formData.current_salary_k}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        current_salary_k: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    min="0"
                    placeholder="如：20"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    期望薪资(k)
                  </label>
                  <input
                    type="number"
                    value={formData.expect_salary_k}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        expect_salary_k: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    min="0"
                    placeholder="如：25"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    备注
                  </label>
                  <textarea
                    value={formData.note}
                    onChange={(e) =>
                      setFormData({ ...formData, note: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                    rows={3}
                    placeholder="请输入备注信息"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-white flex justify-end gap-3">
              <button
                onClick={closeFormModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                {t('cancel')}
              </button>
              <button
                onClick={handleSubmit}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className={`fixed inset-0 bg-black/10 backdrop-blur-md ${closingState.detail ? "animate-fade-out" : ""}`}
            onClick={closeDetailModal}
          />
          <div
            className={`relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col m-4 ${closingState.detail ? "animate-modal-pop-out" : "animate-modal-pop"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  {getDetailTitle()}
                </h3>
                <span className="text-sm text-gray-500">
                  {t('total_items', { total: detailTotal, page: detailPage, totalPages: Math.ceil(detailTotal / 50) })}
                </span>
              </div>
              <button
                onClick={closeDetailModal}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {detailModal === "intent" ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-5 gap-3">
                    {[5, 4, 3, 2, 1].map((score) => {
                      const count = candidates.filter(
                        (c) => c.intent_score === score,
                      ).length;
                      const percent = candidates.length
                        ? ((count / candidates.length) * 100).toFixed(0)
                        : 0;
                      return (
                        <div
                          key={score}
                          className="bg-gray-50 rounded-xl p-4 text-center"
                        >
                          <div className="flex justify-center mb-2">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <div
                                  key={star}
                                  className={`w-3 h-3 rounded-full ${star <= score ? "bg-yellow-400" : "bg-gray-200"}`}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">
                            {count}
                          </p>
                          <p className="text-xs text-gray-500">{percent}%</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                      <h4 className="text-sm font-semibold text-gray-900">
                        候选人列表
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">
                              {t('name')}
                            </th>
                            <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">
                              {t('position')}
                            </th>
                            <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">
                              {t('intent_score')}
                            </th>
                            <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">
                              {t('rfm_segment')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {detailList.map((c) => (
                            <tr
                              key={c.id}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                {c.name}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700">
                                {c.position || "-"}
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-1">
                                  <div className="flex">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <div
                                        key={star}
                                        className={`w-2.5 h-2.5 rounded-full ${star <= c.intent_score ? "bg-yellow-400" : "bg-gray-200"}`}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    {c.intent_score}/5
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-2">
                                <SegmentTag segment={c.segment} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">
                          {t('name')}
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">
                          {t('position')}
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">
                          {t('city')}
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">
                          {t('interview_stage')}
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">
                          {t('recent_contact')}
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">
                          {t('intent_score')}
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">
                          {t('rfm_segment')}
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 whitespace-nowrap">
                          {t('operation')}
                        </th>
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
                          <td
                            colSpan={8}
                            className="px-4 py-8 text-center text-gray-500"
                          >
                            暂无数据
                          </td>
                        </tr>
                      ) : (
                        detailList.map((c) => (
                          <tr
                            key={c.id}
                            className={`hover:bg-gray-50 transition-colors ${c.overdue_followup ? "bg-red-50/30" : ""}`}
                          >
                            <td className="px-4 py-2 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 text-sm">
                                  {c.name}
                                </span>
                                {c.overdue_followup && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    超时
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                              {c.position || "-"}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                              {c.city || "-"}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                                {c.interview_stage || "未面试"}
                              </span>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                              {c.last_contact_days} 天
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <div className="flex">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <div
                                      key={star}
                                      className={`w-2.5 h-2.5 rounded-full ${star <= c.intent_score ? "bg-yellow-400" : "bg-gray-200"}`}
                                    />
                                  ))}
                                </div>
                                <span className="text-xs text-gray-500">
                                  {c.intent_score}/5
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              <SegmentTag segment={c.segment} />
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    closeDetailModal();
                                    handleGenerateStrategy(c);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                  <Play className="w-3 h-3" />
                                  策略
                                </button>
                                <button
                                  onClick={() => {
                                    closeDetailModal();
                                    openFormModal(c);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  编辑
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {detailTotal > 50 && (
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="text-sm text-gray-500">
                  {t('total_items', { total: detailTotal, page: detailPage, totalPages: Math.ceil(detailTotal / 50) })}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setDetailPage(1)}
                    disabled={detailPage === 1}
                    className="px-2 py-1 text-sm rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('home')}
                  </button>
                  <button
                    onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
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
                            onClick={() => setDetailPage(page)}
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
                    onClick={() =>
                      setDetailPage((p) =>
                        Math.min(Math.ceil(detailTotal / 50), p + 1),
                      )
                    }
                    disabled={detailPage >= Math.ceil(detailTotal / 50)}
                    className="px-3 py-1 text-sm rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('next_page')}
                  </button>
                  <button
                    onClick={() =>
                      setDetailPage(Math.ceil(detailTotal / 50))
                    }
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
      )}

      {selectedCandidate && (
        <div className="fixed inset-0 z-50">
          <div
            className={`fixed inset-0 bg-black/10 backdrop-blur-md ${closingState.drawer ? "animate-fade-out" : "animate-fade-in"}`}
            onClick={() => {
              setClosingState((prev) => ({ ...prev, drawer: true }));
              setTimeout(() => {
                setSelectedCandidate(null);
                setClosingState((prev) => ({ ...prev, drawer: false }));
              }, 300);
            }}
          />
          <div
            className={`absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl overflow-hidden flex flex-col ${closingState.drawer ? "animate-slide-out-right" : "animate-slide-in-right"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <div className="h-32 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
                <div className="absolute inset-0 bg-black/10" />
              </div>
              <button
                onClick={() => {
                  setClosingState((prev) => ({ ...prev, drawer: true }));
                  setTimeout(() => {
                    setSelectedCandidate(null);
                    setClosingState((prev) => ({ ...prev, drawer: false }));
                  }, 300);
                }}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute -bottom-12 left-6">
                <div className="w-24 h-24 rounded-2xl bg-white shadow-lg flex items-center justify-center">
                  <span className="text-3xl font-bold bg-gradient-to-br from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                    {selectedCandidate.name.charAt(0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-16 px-6 pb-6 flex-1 overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedCandidate.name}
                  </h2>
                  <p className="text-gray-500">
                    {selectedCandidate.position || t('position_not_filled')}
                  </p>
                </div>
                <SegmentTag segment={selectedCandidate.segment} />
              </div>

              {selectedCandidate.overdue_followup && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-700">
                      {t('post_interview_timeout')}
                    </p>
                    <p className="text-xs text-red-500">{t('suggest_contact_soon')}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    {t('basic_info')}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {t('industry')}：{selectedCandidate.industry || "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {t('city')}：{selectedCandidate.city || "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {t('channel')}：{selectedCandidate.channel || "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {t('recent_contact')}：{selectedCandidate.last_contact_days} {t('days')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4 text-gray-400" />
                    {t('recruitment_progress')}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{t('interview_stage')}</span>
                      <span className="px-2 py-1 bg-white border border-gray-200 text-gray-700 text-xs rounded-full">
                        {stageTranslations[selectedCandidate.interview_stage] || selectedCandidate.interview_stage || t('no_interview')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{t('interaction_count')}</span>
                      <span className="text-sm font-medium text-gray-900">
                        {selectedCandidate.interact_count} {t('times')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{t('intent_score')}</span>
                      <div className="flex items-center gap-1">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <div
                              key={star}
                              className={`w-3 h-3 rounded-full ${star <= selectedCandidate.intent_score ? "bg-yellow-400" : "bg-gray-200"}`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-gray-500 ml-1">
                          {selectedCandidate.intent_score}/5
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    {t('salary_info')}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">{t('current_salary')}</p>
                      <p className="text-lg font-bold text-gray-900">
                        {selectedCandidate.current_salary_k
                          ? `${selectedCandidate.current_salary_k}K`
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">{t('expected_salary')}</p>
                      <p className="text-lg font-bold text-indigo-600">
                        {selectedCandidate.expect_salary_k
                          ? `${selectedCandidate.expect_salary_k}K`
                          : "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {selectedCandidate.note && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      {t('remark')}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {selectedCandidate.note}
                    </p>
                  </div>
                )}

                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    {t('rfm_profile')}
                  </h3>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-white rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-500">R {t('recent_contact')}</p>
                      <p className="text-base font-bold text-gray-900">
                        {selectedCandidate.r || "-"}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-500">F {t('interaction_count')}</p>
                      <p className="text-base font-bold text-gray-900">
                        {selectedCandidate.f || "-"}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-500">I {t('intent_score')}</p>
                      <p className="text-base font-bold text-gray-900">
                        {selectedCandidate.i || "-"}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600">
                    {t('total_score')}{" "}
                    <span className="font-bold text-indigo-600">
                      {selectedCandidate.total || "-"}
                    </span>{" "}
                    {t('points')}，{t('belongs_to', { segment: segmentTranslations[selectedCandidate.segment] || selectedCandidate.segment })}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-white">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setClosingState((prev) => ({ ...prev, drawer: true }));
                    setTimeout(() => {
                      const candidate = selectedCandidate;
                      setSelectedCandidate(null);
                      setClosingState((prev) => ({ ...prev, drawer: false }));
                      openFormModal(candidate);
                    }, 300);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  {t('edit_info')}
                </button>
                <button
                  onClick={() => {
                    setClosingState((prev) => ({ ...prev, drawer: true }));
                    setTimeout(() => {
                      const candidate = selectedCandidate;
                      setSelectedCandidate(null);
                      setClosingState((prev) => ({ ...prev, drawer: false }));
                      handleGenerateStrategy(candidate);
                    }, 300);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all"
                >
                  <Zap className="w-4 h-4" />
                  {t('generate_recall_strategy')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translate3d(100%, 0, 0);
            opacity: 0;
          }
          to {
            transform: translate3d(0, 0, 0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.35s cubic-bezier(0.32, 0.72, 0, 1);
          will-change: transform, opacity;
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
        @keyframes slideOutRight {
          from {
            transform: translate3d(0, 0, 0);
            opacity: 1;
          }
          to {
            transform: translate3d(100%, 0, 0);
            opacity: 0;
          }
        }
        .animate-slide-out-right {
          animation: slideOutRight 0.3s cubic-bezier(0.4, 0, 1, 1) forwards;
          will-change: transform, opacity;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s cubic-bezier(0.32, 0.72, 0, 1);
          will-change: opacity;
        }
      `}</style>

      {toast && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium">{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
