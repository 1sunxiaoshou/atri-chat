import React, { Suspense, useState, useEffect } from 'react';
import { Cpu, Box, Zap, Mic, Menu, PanelLeftOpen } from 'lucide-react';
import { AdminTab } from '../../types';
import { useDataStore } from '../../store/useDataStore';
import { useLanguage } from '../../contexts/LanguageContext';
import { Button } from '../ui';
import { cn } from '../../utils/cn';

const AdminModels = React.lazy(() => import('./models/AdminModels').then((m) => ({ default: m.AdminModels })));
const AdminAvatars = React.lazy(() => import('./vrm/AdminAvatars').then((m) => ({ default: m.AdminAvatars })));
const AdminMotions = React.lazy(() => import('./vrm/AdminMotions').then((m) => ({ default: m.AdminMotions })));
const AdminVoice = React.lazy(() => import('./voice/AdminVoice'));

interface AdminDashboardProps {
  onBack?: () => void;
  onOpenMobileSidebar?: () => void;
  isSidebarHidden?: boolean;
  onShowSidebar?: () => void;
  onDataUpdated?: () => Promise<void>;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onBack: _onBack,
  onOpenMobileSidebar,
  isSidebarHidden,
  onShowSidebar,
  onDataUpdated
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<AdminTab>('models');

  // Use Global Data Store
  const {
    providers,
    models,
    providerTemplates,
    fetchProviders,
    fetchModels,
    fetchTemplates
  } = useDataStore();

  useEffect(() => {
    fetchProviders();
    fetchModels();
    fetchTemplates();
  }, [fetchProviders, fetchModels, fetchTemplates]);

  const fetchData = async () => {
    await Promise.all([
      fetchProviders(true),
      fetchModels(true)
    ]);

    // 通知父组件数据已更新
    if (onDataUpdated) {
      await onDataUpdated();
    }
  };

  const fetchVRMModels = async () => {
    // VRM model data refresh logic (if needed)
  };

  const fetchAnimations = async () => {
    // Animation data refresh logic (if needed)
  };



  const tabs = [
    { id: 'models', label: t('admin.models'), icon: Cpu },
    { id: 'vrm', label: t('admin.vrm3d'), icon: Box },
    { id: 'animations', label: t('admin.animations'), icon: Zap },
    { id: 'voice', label: t('admin.voice'), icon: Mic },
  ];

  return (
    <div className="flex flex-col h-full bg-muted/30 relative">
      {/* Header & Tabs */}
      <header className="bg-background border-b border-border px-4 lg:px-2">
        <div className="h-16 md:h-18 flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenMobileSidebar}
              className="lg:hidden"
              aria-label={t('app.openMenu')}
            >
              <Menu size={20} />
            </Button>

          {/* Desktop Show Sidebar Button */}
          <div
            className={cn(
              "hidden lg:flex items-center transition-all duration-300 ease-in-out overflow-hidden",
              isSidebarHidden ? "w-10 opacity-100 -ml-1 mr-1" : "w-0 opacity-0 m-0"
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={onShowSidebar}
              className="h-9 w-9 gap-0 text-muted-foreground hover:text-primary hover:bg-transparent rounded-lg [&_svg]:size-5"
              title={t('admin.showSidebar')}
            >
              <PanelLeftOpen size={20} />
            </Button>
          </div>

          <h2 className={cn(
            "text-2xl font-bold tracking-tight text-foreground transition-all duration-300",
            !isSidebarHidden && "lg:ml-2"
          )}>{t('admin.title')}</h2>
        </div>

        {/* --- Tab 栏优化 --- */}
        <nav className={cn(
          "flex gap-6 lg:gap-10 overflow-x-auto scrollbar-hide -mx-4 px-4 transition-all duration-300",
          "lg:mx-0",
          isSidebarHidden ? "lg:px-12" : "lg:px-2"
        )}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={cn(
                  "group pb-4 px-1 flex items-center gap-2 font-medium transition-colors duration-300 relative whitespace-nowrap flex-shrink-0 text-sm",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={18} className={cn("transition-transform duration-300", isActive && "scale-110")} />
                <span>{tab.label}</span>

                {/* 
                   优化点 1: 底部指示条动画 
                   不再使用 {isActive && ...} 的销毁模式，而是始终渲染，
                   通过 scale-x 和 opacity 来控制显隐，实现平滑的生长效果。
                */}
                <span className={cn(
                  "absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full transition-all duration-300 ease-out transform origin-center",
                  isActive ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0 group-hover:scale-x-50 group-hover:opacity-30" // 增加 Hover 时的淡入提示
                )} />
              </button>
            );
          })}
        </nav>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full">
          {/* 
             优化点 2: 内容切换动画 
             添加 key={activeTab} 是最关键的一步。
             它告诉 React 当 tab 变化时，这是个新元素，从而强制触发 animate-in 动画。
          */}
          <div
            key={activeTab}
            className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out"
          >
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground animate-pulse">
                  {t('app.loading')}
                </div>
              }
            >
              {activeTab === 'models' && (
                <AdminModels
                  providers={providers}
                  models={models}
                  providerTemplates={providerTemplates}
                  onRefresh={fetchData}
                />
              )}
              {activeTab === 'vrm' && <AdminAvatars onAvatarsChange={fetchVRMModels} />}
              {activeTab === 'animations' && <AdminMotions onMotionsChange={fetchAnimations} />}
              {activeTab === 'voice' && <AdminVoice />}
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
