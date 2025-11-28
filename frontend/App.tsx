import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import AdminDashboard from './components/AdminDashboard';
import { Conversation, ViewMode, Character, Model } from './types';
import { api } from './services/api';
import { useLanguage } from './contexts/LanguageContext';

const App: React.FC = () => {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [models, setModels] = useState<Model[]>([]);

  // Helper function to get character ID (supports both character_id and id)
  const getCharacterId = (char: Character): number => {
    return (char.character_id || char.id || 0) as number;
  };

  // Helper function to get conversation ID
  const getConversationId = (conv: Conversation): number => {
    return Number(conv.conversation_id || conv.id || 0);
  };

  // Character Selection State
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);

  // Computed state
  const activeConversation = conversations.find(c => getConversationId(c) === activeConversationId);
  const activeCharacter = characters.find(c => getCharacterId(c) === activeConversation?.character_id) || null;

  // Local state for temporary model override in chat
  const [activeModelId, setActiveModelId] = useState<string | null>(null);

  const activeModel = models.find(m => m.model_id === (activeModelId || activeCharacter?.primary_model_id)) || null;

  // 初始化加载数据
  useEffect(() => {
    loadGlobalData();
    loadConversations(selectedCharacterId);
  }, []); // 只在组件挂载时执行一次

  // 当选择的角色变化时，重新加载对话列表
  useEffect(() => {
    if (characters.length > 0) { // 确保角色已加载
      loadConversations(selectedCharacterId);
    }
  }, [selectedCharacterId]);

  // 从管理页面返回时，刷新数据
  useEffect(() => {
    if (viewMode === 'chat' && characters.length > 0) {
      loadGlobalData(true);
      loadConversations(selectedCharacterId);
    }
  }, [viewMode]);

  const loadGlobalData = async (force = false) => {
    // Load characters if empty or forced
    if (force || characters.length === 0) {
      const charRes = await api.getCharacters();
      if (charRes.code === 200) setCharacters(charRes.data);
    }
    // Load models if empty or forced
    if (force || models.length === 0) {
      const modelRes = await api.getModels();
      if (modelRes.code === 200) setModels(modelRes.data);
    }
  };

  const loadConversations = async (charId: number | null) => {
    // API supports filtering by character_id
    const res = await api.getConversations(charId);
    if (res.code === 200) {
      setConversations(res.data);
      // If we just switched characters and have conversations, pick the first one
      if (charId && res.data.length > 0 && (!activeConversationId || !res.data.find(c => getConversationId(c) === activeConversationId))) {
        setActiveConversationId(getConversationId(res.data[0]));
      } else if (charId && res.data.length === 0) {
        setActiveConversationId(null);
      } else if (!charId && res.data.length > 0 && !activeConversationId) {
        // Fallback for 'All' view if nothing selected
        setActiveConversationId(getConversationId(res.data[0]));
      }
    }
  };

  const handleNewChat = async () => {
    // Default to selected character or the first available character
    const defaultCharId = selectedCharacterId || (characters[0] ? getCharacterId(characters[0]) : 1);
    const res = await api.createConversation(Number(defaultCharId));
    if (res.code === 200) {
      setConversations(prev => [res.data, ...prev]);
      setActiveConversationId(getConversationId(res.data));

      // If we are currently filtering by a DIFFERENT character, switch filter to this new one
      if (selectedCharacterId && selectedCharacterId !== Number(res.data.character_id)) {
        setSelectedCharacterId(Number(res.data.character_id));
      }
      setViewMode('chat');
    }
  };

  const handleDeleteConversation = async (id: number) => {
    await api.deleteConversation(id);
    setConversations(prev => prev.filter(c => getConversationId(c) !== id));
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
      <Sidebar
        viewMode={viewMode}
        setViewMode={setViewMode}
        conversations={conversations} // Passed filtered list directly
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        characters={characters.filter(c => c.enabled)}
        selectedCharacterId={selectedCharacterId}
        onSelectCharacter={handleCharacterSelect}
      />

      <main className="flex-1 h-full relative">
        {viewMode === 'chat' ? (
          activeConversationId ? (
            <ChatInterface
              activeConversationId={activeConversationId}
              activeCharacter={activeCharacter}
              activeModel={activeModel}
              availableModels={models.filter(m => m.enabled)}
              onUpdateModel={setActiveModelId}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50/30">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6 overflow-hidden">
                {selectedCharacterId ? (
                  <img
                    src={characters.find(c => getCharacterId(c) === selectedCharacterId)?.avatar}
                    className="w-full h-full object-cover opacity-80"
                    alt="Character"
                  />
                ) : (
                  <span className="text-2xl">✨</span>
                )}
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                {selectedCharacterId
                  ? `${t('app.startChatting')} ${characters.find(c => getCharacterId(c) === selectedCharacterId)?.name}`
                  : t('app.selectConversation')}
              </h3>
              <p className="text-gray-500 mb-8 max-w-sm text-center">
                {selectedCharacterId
                  ? characters.find(c => getCharacterId(c) === selectedCharacterId)?.system_prompt.substring(0, 100) + '...'
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
          <AdminDashboard onBack={() => setViewMode('chat')} />
        )}
      </main>
    </div>
  );
};

export default App;