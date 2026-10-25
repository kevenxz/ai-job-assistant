import { useCallback, useEffect, useState } from 'react';
import {
  BriefcaseBusiness,
  ExternalLink,
  LayoutDashboard,
  RefreshCw,
  ServerOff,
  Settings,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type { Bootstrap } from '../../../src/shared/types';
import { api } from './api';
import type { PageKey } from './page-types';
import { JobsPage } from './pages/JobsPage';
import { OverviewPage } from './pages/OverviewPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { Button, Toast, type ToastState } from './ui';

const NAV_ITEMS: Array<{ key: PageKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'overview', label: '求职总览', icon: LayoutDashboard },
  { key: 'profile', label: '我的资料', icon: UserRound },
  { key: 'jobs', label: '岗位与投递', icon: BriefcaseBusiness },
  { key: 'settings', label: '设置', icon: Settings },
];

const PAGE_META: Record<PageKey, { title: string; description: string }> = {
  overview: { title: '求职总览', description: '今天的岗位、对话和投递进展，都在这里。' },
  profile: { title: '我的资料', description: '这是所有简历与回复的唯一事实来源，请保持准确。' },
  jobs: { title: '岗位与投递', description: '分析匹配度、生成定制简历，并记录每一次沟通。' },
  settings: { title: '设置', description: '配置模型、投递风控和简历样式。数据只留在本机。' },
};

function readPage(): PageKey {
  const value = window.location.hash.replace(/^#\/?/, '') as PageKey;
  return NAV_ITEMS.some((item) => item.key === value) ? value : 'overview';
}

export default function App() {
  const [page, setPage] = useState<PageKey>(readPage);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);

  const notify = useCallback((type: ToastState['type'], message: string) => {
    setToast({ id: Date.now(), type, message });
  }, []);

  const refreshBootstrap = useCallback(async () => {
    try {
      const data = await api.bootstrap();
      setBootstrap(data);
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '无法连接本地服务');
    }
  }, []);

  useEffect(() => {
    refreshBootstrap();
    const onHashChange = () => setPage(readPage());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [refreshBootstrap]);

  const navigate = useCallback((next: PageKey) => {
    window.location.hash = `#/${next}`;
    setPage(next);
  }, []);

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
    refreshBootstrap();
  }, [refreshBootstrap]);

  if (!bootstrap) {
    if (loadError) {
      return (
        <div className="boot-screen">
          <div className="boot-card">
            <div className="boot-icon">
              <ServerOff size={26} />
            </div>
            <h1>无法连接本地服务</h1>
            <p>{loadError}</p>
            <p className="muted">
              请确认项目根目录的服务已经启动。开发模式运行 <code>npm run dev</code>，或生产模式先{' '}
              <code>npm run build</code> 再运行 <code>npm start</code>。
            </p>
            <Button onClick={refreshBootstrap}>重试连接</Button>
          </div>
        </div>
      );
    }
    return (
      <div className="boot-screen">
        <div className="boot-loading">
          <Sparkles size={22} className="spin" />
          正在连接本地服务…
        </div>
      </div>
    );
  }

  const meta = PAGE_META[page];
  const pageProps = {
    bootstrap,
    refreshKey,
    navigate,
    refreshBootstrap,
    notify,
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">AI</div>
          <div className="brand-text">
            <b>AI 求职助手</b>
            <span>BOSS 直聘 · 本地版</span>
          </div>
        </div>

        <nav className="nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const incomplete =
              (item.key === 'profile' && !bootstrap.profileReady) ||
              (item.key === 'settings' && !bootstrap.llmConfigured);
            return (
              <button
                key={item.key}
                className={`nav-item ${page === item.key ? 'active' : ''}`}
                onClick={() => navigate(item.key)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {incomplete && <i className="nav-dot" title="还需要配置" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-note">
          <b>只在你确认后发送</b>
          <p>扩展负责页面操作，本地服务负责 AI 与数据。请控制投递频率，遵守平台规则。</p>
        </div>

        <div className="sidebar-footer">
          <span className="status-dot" />
          <span>本地服务已连接</span>
          <em>v{bootstrap.version}</em>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="page-heading">
            <h1>{meta.title}</h1>
            <p>{meta.description}</p>
          </div>
          <div className="topbar-actions">
            <span className={`badge ${bootstrap.llmConfigured ? 'badge-green' : 'badge-amber'}`}>
              {bootstrap.llmConfigured ? '模型已就绪' : '未配置模型'}
            </span>
            <button className="icon-btn" onClick={refresh} title="刷新数据" aria-label="刷新数据">
              <RefreshCw size={16} />
            </button>
            <a
              className="btn btn-secondary btn-sm"
              href="https://www.zhipin.com/web/geek/jobs"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={14} />
              BOSS 直聘
            </a>
          </div>
        </header>

        <div className="content">
          {page === 'overview' && <OverviewPage {...pageProps} />}
          {page === 'profile' && <ProfilePage {...pageProps} />}
          {page === 'jobs' && <JobsPage {...pageProps} />}
          {page === 'settings' && <SettingsPage {...pageProps} />}
        </div>
      </main>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
