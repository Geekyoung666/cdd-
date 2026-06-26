import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, Eye, EyeOff, Users, MessageSquare } from 'lucide-react';

export default function LoginPage({ onLogin, onGuestLogin, onLanguageChange, currentLang }) {
  const { t } = useTranslation('common');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await onLogin(email, password);
    } catch (err) {
      setError(t('login_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    try {
      await onGuestLogin();
    } catch (err) {
      setError(t('login_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeishuLogin = () => {
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');
    window.location.href = `${apiBaseUrl}/api/feishu/login`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl p-8 border border-white/50">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('title')}</h1>
            <p className="text-gray-500">{t('subtitle')} {t('author')}</p>
          </div>

          <button
            onClick={() => onLanguageChange(currentLang === 'zh' ? 'en' : 'zh')}
            className="mb-6 w-full py-2 px-4 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600 text-sm font-medium"
          >
            {currentLang === 'zh' ? t('english') : t('chinese')}
          </button>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('email')}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/80"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('password')}
                  className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/80"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input type="checkbox" className="w-4 h-4 text-blue-500 border-gray-300 rounded" />
                <span className="ml-2 text-sm text-gray-600">{t('remember_me')}</span>
              </label>
              <a href="#" className="text-sm text-blue-500 hover:text-blue-600">
                {t('forgot_password')}
              </a>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
            >
              {isLoading ? t('loading') : t('login')}
            </button>
          </form>

          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-200" />
            <span className="px-4 text-sm text-gray-400">OR</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          <button
            onClick={handleFeishuLogin}
            disabled={isLoading}
            className="w-full py-3 bg-[#00B42A] text-white font-medium rounded-lg hover:bg-[#00a327] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#00B42A]/25"
          >
            <MessageSquare className="w-5 h-5" />
            {t('feishu_login')}
          </button>

          <button
            onClick={handleGuestLogin}
            disabled={isLoading}
            className="w-full mt-3 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Users className="w-5 h-5" />
            {t('guest_login')}
          </button>

          <p className="mt-6 text-center text-sm text-gray-400">
            {t('guest_warning')}
          </p>
        </div>
      </div>
    </div>
  );
}
