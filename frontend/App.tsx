import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/chat/ChatInterface';
import AdminDashboard from './components/admin/AdminDashboard';

import SettingsModal from './components/settings/SettingsModal';
import { Conversation, ViewMode, Character, Model } from './types';
import { api } from './services/api/index';
import { useLanguage } from './contexts/LanguageContext';
import { buildAvatarUrl } from './utils/url';

const App: React.FC = () => {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [models, setModels] = useState<Model[]>([]);

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Character Selection State
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);

  // Mobile Sidebar State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Computed state
  const activeConversation = conversations.find(c => c.conversation_id === activeConversationId);
  const activeCharacter = characters.find(c => c.character_id === activeConversation?.character_id) || null;

  // Local state for temporary model override in chat
  const [activeModelId, setActiveModelId] = useState<string | null>(null);

  const activeModel = models.find(m => m.model_id === (activeModelId || activeCharacter?.primary_model_id)) || null;

  useEffect(() => {
    loadGlobalData();
    loadConversations(selectedCharacterId);
  }, [selectedCharacterId]); // Reload conversations when character selection changes

  // Reload data when returning from Admin view to ensure new characters/models appear
  useEffect(() => {
    if (viewMode === 'chat') {
      loadGlobalData(true);
      loadConversations(selectedCharacterId);
    }
  }, [viewMode]);

  const loadGlobalData = async (force = false) => {
    // Load characters if empty or forced
    if (force || characters.length === 0) {
      const charRes = await api.getCharacters();
      if (charRes.code === 200) {
        setCharacters(charRes.data);
      }
    }
    // Load models if empty or forced
    if (force || models.length === 0) {
      const modelRes = await api.getModels();
      if (modelRes.code === 200) {
        setModels(modelRes.data);
      }
    }
  };

  const loadConversations = async (charId: number | null) => {
    // API supports filtering by character_id
    const res = await api.getConversations(charId);
    if (res.code === 200) {
      setConversations(res.data);
      // If we just switched characters and have conversations, pick the first one
      if (charId && res.data.length > 0 && res.data[0] && (!activeConversationId || !res.data.find(c => c.conversation_id === activeConversationId))) {
        setActiveConversationId(res.data[0].conversation_id);
      } else if (charId && res.data.length === 0) {
        setActiveConversationId(null);
      } else if (!charId && res.data.length > 0 && res.data[0] && !activeConversationId) {
        // Fallback for 'All' view if nothing selected
        setActiveConversationId(res.data[0].conversation_id);
      }
    }
  };

  const handleNewChat = async () => {
    // Default to selected character or the first available character
    const defaultCharId = selectedCharacterId || (characters[0] ? characters[0].character_id : 1);
    const res = await api.createConversation(Number(defaultCharId));
    if (res.code === 200) {
      setConversations(prev => [res.data, ...prev]);
      setActiveConversationId(res.data.conversation_id);

      // If we are currently filtering by a DIFFERENT character, switch filter to this new one
      if (selectedCharacterId && selectedCharacterId !== res.data.character_id) {
        setSelectedCharacterId(res.data.character_id);
      }
      setViewMode('chat');
    }
  };

  const handleDeleteConversation = async (id: number) => {
    await api.deleteConversation(id);
    setConversations(prev => prev.filter(c => c.conversation_id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
    }
  };

  // Handle Switching Characters
  const handleCharacterSelect = (charId: number | null) => {
    setSelectedCharacterId(charId);
    // loadConversations is triggered by useEffect dependency on selectedCharacterId
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      {/* Mobile Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:relative inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:transform-none ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <Sidebar
          viewMode={viewMode}
          setViewMode={setViewMode}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={(id) => {
            setActiveConversationId(id);
            setIsMobileSidebarOpen(false); // 选择对话后关闭侧边栏
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
            setIsSettingsOpen(true);
            setIsMobileSidebarOpen(false);
          }}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
      </div>

      <main className="flex-1 h-full relative w-full lg:w-auto">
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
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50/30 relative">
              {/* Mobile Menu Button for Empty State */}
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="lg:hidden absolute top-4 left-4 p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                aria-label="Open menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6 overflow-hidden">
                {selectedCharacterId ? (
                  <img
                    src={buildAvatarUrl(characters.find(c => c.character_id === selectedCharacterId)?.avatar)}
                    className="w-full h-full object-cover opacity-80"
                    alt="Character"
                  />
                ) : (
                  <span className="text-2xl">✨</span>
                )}
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2 px-4 text-center">
                {selectedCharacterId
                  ? `${t('app.startChatting')} ${characters.find(c => c.character_id === selectedCharacterId)?.name}`
                  : t('app.selectConversation')}
              </h3>
              <p className="text-gray-500 mb-8 max-w-sm text-center px-4">
                {selectedCharacterId
                  ? characters.find(c => c.character_id === selectedCharacterId)?.system_prompt.substring(0, 100) + '...'
                  : t('app.selectCharHelp')
                }
              </p>
              <button
                onClick={handleNewChat}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 font-medium flex items-center gap-2"
              >
                <span>+</span> {t('app.startNewChat')}
              </button>
            </div>
          )
        ) : (
          <AdminDashboard 
            onBack={() => setViewMode('chat')} 
            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          />
        )}
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default App;