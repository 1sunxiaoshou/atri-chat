import React, { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import ChatInterface from './components/chat/ChatInterface';
import AdminDashboard from './components/admin/AdminDashboard';
import SettingsView from './components/settings/SettingsView';
import { AdminCharacters } from './components/characters/AdminCharacters';
import Toast, { ToastMessage } from './components/ui/Toast';
import { Conversation, ViewMode, Character, Model } from './types';
import { api } from './services/api/index';
import { useLanguage } from './contexts/LanguageContext';
import { buildAvatarUrl } from './utils/url';
import { Button } from './components/ui';
import { Plus, Sparkles, Menu, PanelLeftOpen } from 'lucide-react';
import { cn } from './utils/cn';

const App: React.FC = () => {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | string | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [models, setModels] = useState<Model[]>([]);

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
  const [activeModelId, setActiveModelId] = useState<string | null>(null);

  // 查找活动模型：activeModelId 和 primary_model_id 都是 UUID
  const activeModel = models.find(m => m.id === (activeModelId || activeCharacter?.primary_model_id)) || null;

  useEffect(() => {
    loadGlobalData();
    loadConversations(selectedCharacterId);
  }, [selectedCharacterId]); // Reload conversations when character selection changes

  // Reload data when returning from Admin view to ensure new characters/models appear
  useEffect(() => {
    if (viewMode === 'chat') {
      loadGlobalData(true);
      loadConversations(selectedCharacterId);
    } else if (viewMode === 'characters' || viewMode === 'admin') {
      loadGlobalData(true);
    }
  }, [viewMode]);

  const loadGlobalData = async (force = false) => {
    // Load characters - 总是重新加载当 force=true
    if (force) {
      const charRes = await api.getCharacters();
      if (charRes.code === 200) {
        setCharacters(charRes.data);
      }
    } else if (characters.length === 0) {
      // 只在初始化时加载
      const charRes = await api.getCharacters();
      if (charRes.code === 200) {
        setCharacters(charRes.data);
      }
    }

    // Load models - 总是重新加载当 force=true
    if (force) {
      const modelRes = await api.getModels();
      if (modelRes.code === 200) {
        setModels(modelRes.data);
      }
    } else if (models.length === 0) {
      // 只在初始化时加载
      const modelRes = await api.getModels();
      if (modelRes.code === 200) {
        setModels(modelRes.data);
      }
    }
  };

  const loadConversations = async (charId: string | null) => {
    // API supports filtering by character_id
    const res = await api.getConversations(charId);
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

    const res = await api.createConversation(defaultCharId);
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
    await api.deleteConversation(id);
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
        {viewMode === 'chat' ? (
          activeConversationId ? (
            <ChatInterface
              activeConversationId={activeConversationId}
              activeCharacter={activeCharacter}
              activeModel={activeModel}
              availableModels={models.filter(m => m.enabled)}
              onUpdateModel={setActiveModelId}
              onConversationUpdated={() => loadConversations(selectedCharacterId)}
              onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
              onShowSidebar={() => setIsLeftSidebarHidden(false)}
              isSidebarHidden={isLeftSidebarHidden}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full bg-muted/10 relative p-6 animate-in fade-in duration-500">
              {/* Mobile Menu Button for Empty State */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="lg:hidden absolute top-4 left-4 h-10 w-10 text-muted-foreground hover:text-foreground"
                aria-label="Open menu"
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
                        : buildAvatarUrl(`/uploads/vrm_thumbnails/${selectedCharacterId}.jpg`);
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
          />
        ) : viewMode === 'characters' ? (
          <AdminCharacters
            characters={characters}
            models={models}
            onRefresh={() => loadGlobalData(true)}
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
      </main>
    </div>
  );
};

export default App;
