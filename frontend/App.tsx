import React, { useState, useEffect, Suspense } from 'react';
import Sidebar from './components/layout/Sidebar';
import Toast, { ToastMessage } from './components/ui/Toast';

const ChatInterface = React.lazy(() => import('./components/chat/ChatInterface'));
const AdminDashboard = React.lazy(() => import('./components/admin/AdminDashboard'));
const SettingsView = React.lazy(() => import('./components/settings/SettingsView'));
const AdminCharacters = React.lazy(() => import('./components/characters/AdminCharacters').then(m => ({ default: m.AdminCharacters })));
import { Conversation, ViewMode, Model } from './types';
import { conversationsApi } from './services/api/conversations';
import { useLanguage } from './contexts/LanguageContext';
import { buildAvatarUrl } from './utils/url';
import { Button } from './components/ui/Button';
import { Plus, Sparkles, Menu, PanelLeftOpen } from 'lucide-react';
import { cn } from './utils/cn';
import { useDataStore } from './store/useDataStore';

const App: React.FC = () => {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | string | null>(null);
  
  // Use Global Data Store
  const { 
    characters, 
    models, 
    providers,
    fetchCharacters, 
    fetchModels,
    fetchProviders
  } = useDataStore();

  // Character Selection State
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  // Mobile Sidebar State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Desktop Sidebar Hidden State
  const [isLeftSidebarHidden, setIsLeftSidebarHidden] = useState(false);

  // Toast State
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);

  // Computed state
  const activeConversation = conversations.find(c => (c.id || c.conversation_id) === activeConversationId);
  const activeCharacter = characters.find(c => c.id === activeConversation?.character_id) || null;

  // Local state for temporary model override in chat
  const [overrideModel, setOverrideModel] = useState<{ id: number; model_id: string; provider_config_id: number } | null>(null);

  // 查找活动模型：优先使用临时覆盖的模型，否则使用角色的主模型
  const activeModel = overrideModel
    ? overrideModel as any as Model
    : activeCharacter?.primary_model
      ? {
        id: activeCharacter.primary_model.id,
        model_id: activeCharacter.primary_model.model_id,
        provider_config_id: activeCharacter.primary_model.provider_config_id
      } as Model
      : null;

  // 统一的数据加载逻辑
  useEffect(() => {
    if (viewMode === 'chat') {
      fetchCharacters();
      fetchProviders(); // 必须获取 providers 才能正确显示供应商名称
      loadConversations(selectedCharacterId);
    } else if (viewMode === 'characters') {
      // 角色管理页面需要 characters, models 和 providers 数据
      fetchCharacters();
      fetchModels();
      fetchProviders();
    }
  }, [selectedCharacterId, viewMode, fetchCharacters, fetchModels]);

  // 当角色列表更新时，检查当前选中的角色是否仍然有效
  const { loading: dataLoading } = useDataStore();
  useEffect(() => {
    // 只有在数据加载完成且列表不为空的情况下，如果当前选中的角色不在列表中，才进行清理
    // 如果 characters 为空且不在加载中，说明确实没角色了
    if (selectedCharacterId && !dataLoading.characters) {
      const exists = characters.find(c => c.id === selectedCharacterId);
      if (!exists) {
        setSelectedCharacterId(null);
        setActiveConversationId(null);
      }
    }
  }, [characters, selectedCharacterId, dataLoading.characters]);

  // 处理模型切换
  const handleUpdateModel = (modelData: string) => {
    try {
      const model = JSON.parse(modelData);
      setOverrideModel(model);
    } catch (error) {
      console.error('Failed to parse model data:', error);
    }
  };



  const loadConversations = async (charId: string | null) => {
    try {
      const res = await conversationsApi.getConversations(charId);
      if (res.code === 200) {
        setConversations(res.data);
        // If we just switched characters and have conversations, pick the first one
        if (charId && res.data.length > 0 && res.data[0] && (!activeConversationId || !res.data.find(c => (c.id || c.conversation_id) === activeConversationId))) {
          setActiveConversationId(res.data[0].id || res.data[0].conversation_id || null);
        } else if (charId && res.data.length === 0) {
          setActiveConversationId(null);
        } else if (!charId && res.data.length > 0 && res.data[0] && !activeConversationId) {
          // Fallback for 'All' view if nothing selected
          setActiveConversationId(res.data[0].id || res.data[0].conversation_id || null);
        }
      } else {
        // Handle API error (e.g. character deleted)
        setConversations([]);
        setActiveConversationId(null);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setConversations([]);
    }
  };

  const handleNewChat = async () => {
    // 必须有选中的角色或至少有一个可用角色
    const defaultCharId = selectedCharacterId || (characters[0]?.id);

    if (!defaultCharId) {
      // 没有可用角色，提示用户
      setToastMessage({
        success: false,
        message: t('app.noCharacterAvailable')
      });
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    const res = await conversationsApi.createConversation(defaultCharId);
    if (res.code === 200) {
      setConversations(prev => [res.data, ...prev]);
      setActiveConversationId(res.data.id || res.data.conversation_id || null);

      // If we are currently filtering by a DIFFERENT character, switch filter to this new one
      if (selectedCharacterId && selectedCharacterId !== res.data.character_id) {
        setSelectedCharacterId(res.data.character_id);
      }
      setViewMode('chat');
    } else {
      // 处理创建失败的情况
      setToastMessage({
        success: false,
        message: res.message || t('app.createConversationFailed')
      });
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleDeleteConversation = async (id: string | number) => {
    await conversationsApi.deleteConversation(id);
    setConversations(prev => prev.filter(c => (c.id || c.conversation_id) !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
    }
  };

  // Handle Switching Characters
  const handleCharacterSelect = (charId: string | null) => {
    setSelectedCharacterId(charId);
    // loadConversations is triggered by useEffect dependency on selectedCharacterId
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Toast 提示 */}
      <Toast message={toastMessage} />

      {/* Mobile Overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300",
          isMobileSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsMobileSidebarOpen(false)}
      />

      {/* Sidebar Wrapper */}
      <aside
        className={cn(
          // 基础样式
          "h-full z-50 transition-[margin,transform] duration-300 ease-in-out bg-sidebar border-r border-sidebar-border",
          // 移动端：固定定位，通过 translate 切换
          "fixed inset-y-0 left-0 w-64 lg:static",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          // 桌面端：通过负 margin 实现平滑推拉效果
          isLeftSidebarHidden ? "lg:ml-[-256px]" : "lg:ml-0"
        )}
      >
        <Sidebar
          viewMode={viewMode}
          setViewMode={setViewMode}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={(id) => {
            setActiveConversationId(id);
            setIsMobileSidebarOpen(false);
          }}
          onNewChat={() => {
            handleNewChat();
            setIsMobileSidebarOpen(false);
          }}
          onDeleteConversation={handleDeleteConversation}
          characters={characters.filter(c => c.enabled)}
          selectedCharacterId={selectedCharacterId}
          onSelectCharacter={(charId) => {
            handleCharacterSelect(charId);
            setIsMobileSidebarOpen(false);
          }}
          onOpenSettings={() => {
            setViewMode('settings');
            setIsMobileSidebarOpen(false);
          }}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          onHideSidebar={() => setIsLeftSidebarHidden(true)}
        />
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden bg-background transition-all duration-300">
        <Suspense fallback={<div className="flex w-full h-full items-center justify-center text-muted-foreground">{t('app.loading')}</div>}>
        {viewMode === 'chat' ? (
          activeConversationId ? (
            <ChatInterface
              activeConversationId={activeConversationId}
              activeCharacter={activeCharacter}
              activeModel={activeModel}
              onUpdateModel={handleUpdateModel}
              onConversationUpdated={() => loadConversations(selectedCharacterId)}
              onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
              onShowSidebar={() => setIsLeftSidebarHidden(false)}
              isSidebarHidden={isLeftSidebarHidden}
              setGlobalToast={setToastMessage}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full bg-muted/10 relative p-6 animate-in fade-in duration-500">
              {/* Mobile Menu Button for Empty State */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="lg:hidden absolute top-4 left-4 h-10 w-10 text-muted-foreground hover:text-foreground"
                aria-label={t('app.openMenu')}
              >
                <Menu size={20} />
              </Button>

              {/* Desktop Show Sidebar Button */}
              {isLeftSidebarHidden && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsLeftSidebarHidden(false)}
                  className="hidden lg:flex absolute top-4 left-4 h-10 w-10 text-muted-foreground z-10"
                >
                  <PanelLeftOpen size={20} />
                </Button>
              )}

              <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-8 overflow-hidden ring-4 ring-background shadow-2xl transition-transform hover:scale-110 duration-500">
                {selectedCharacterId ? (
                  (() => {
                    const selectedChar = characters.find(c => c.id === selectedCharacterId);
                      const avatarUrl = selectedChar?.portrait_url
                        ? buildAvatarUrl(selectedChar.portrait_url)
                        : selectedChar?.avatar?.thumbnail_url
                          ? buildAvatarUrl(selectedChar.avatar.thumbnail_url)
                          : buildAvatarUrl(`/static/vrm/thumbnails/${selectedCharacterId}.jpg`);
                    return (
                      <img
                        src={avatarUrl}
                        className="w-full h-full object-cover opacity-80"
                        alt="Character"
                      />
                    );
                  })()
                ) : (
                  <Sparkles size={40} className="text-primary animate-pulse" />
                )}
              </div>

              <div className="max-w-md text-center space-y-4">
                <h3 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight px-4">
                  {selectedCharacterId
                    ? `${t('app.startChatting')} ${characters.find(c => c.id === selectedCharacterId)?.name}`
                    : t('app.selectConversation')}
                </h3>
                <p className="text-muted-foreground text-sm md:text-base leading-relaxed px-4 max-w-sm mx-auto">
                  {selectedCharacterId
                    ? characters.find(c => c.id === selectedCharacterId)?.system_prompt.substring(0, 100) + '...'
                    : t('app.selectCharHelp')
                  }
                </p>
              </div>

              <div className="mt-10">
                <Button
                  onClick={handleNewChat}
                  size="lg"
                  className="gap-2 rounded-2xl shadow-xl shadow-primary/20 font-bold uppercase tracking-widest text-xs h-12 px-8"
                >
                  <Plus size={18} />
                  {t('app.startNewChat')}
                </Button>
              </div>
            </div>
          )
        ) : viewMode === 'admin' ? (
          <AdminDashboard
            onBack={() => setViewMode('chat')}
            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
            isSidebarHidden={isLeftSidebarHidden}
            onShowSidebar={() => setIsLeftSidebarHidden(false)}
            onDataUpdated={async () => {
              // 当 AdminDashboard 更新数据后，刷新 App 层的数据
              // 触发 Store 的强制刷新保证数据同步
              await Promise.all([
                fetchCharacters(true),
                fetchModels(true)
              ]);
            }}
          />
        ) : viewMode === 'characters' ? (
          <AdminCharacters
            characters={characters}
            models={models}
            providers={providers}
            onRefresh={async () => {
              await Promise.all([
                fetchCharacters(true),
                fetchModels(true),
                fetchProviders(true)
              ]);
            }}
            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
            isSidebarHidden={isLeftSidebarHidden}
            onShowSidebar={() => setIsLeftSidebarHidden(false)}
          />
        ) : viewMode === 'settings' ? (
          <SettingsView
            onBack={() => setViewMode('chat')}
            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
            isSidebarHidden={isLeftSidebarHidden}
            onShowSidebar={() => setIsLeftSidebarHidden(false)}
          />
        ) : null}
        </Suspense>
      </main>
    </div>
  );
};

export default App;
