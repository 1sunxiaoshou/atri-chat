import React, { useState, useEffect, useRef } from 'react';
import { Plus, MessageSquare, Settings, LayoutDashboard, Trash2, Users, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Conversation, ViewMode, Character } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { buildAvatarUrl } from '../utils/url';

interface SidebarProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  conversations: Conversation[];
  activeConversationId: number | null;
  onSelectConversation: (id: number) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: number) => void;
  characters: Character[];
  selectedCharacterId: number | null;
  onSelectCharacter: (id: number | null) => void;
  onOpenSettings: () => void;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  viewMode,
  setViewMode,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  characters,
  selectedCharacterId,
  onSelectCharacter,
  onOpenSettings,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const { t } = useLanguage();

  // Local state for handling sorting locally (since backend doesn't persist order in this mock)
  const [localCharacters, setLocalCharacters] = useState<Character[]>(characters);
  const [draggedItem, setDraggedItem] = useState<Character | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Map<number, HTMLButtonElement>>(new Map());

  // Sync props to local state while preserving custom order
  useEffect(() => {
    setLocalCharacters(prev => {
      const prevMap = new Map(prev.map(c => [c.character_id, c]));
      const newIds = new Set(characters.map(c => c.character_id));

      // 1. Keep existing items in their current order (preserve user sort)
      const existing = prev
        .filter(c => newIds.has(c.character_id))
        .map(c => {
          // Update data if changed (e.g. name/avatar edit)
          const updatedData = characters.find(nc => nc.character_id === c.character_id);
          return updatedData || c;
        });

      // 2. Append new items
      const brandNew = characters.filter(c => !prevMap.has(c.character_id));

      return [...existing, ...brandNew];
    });
  }, [characters]);

  // Auto-scroll to selected character
  useEffect(() => {
    if (selectedCharacterId !== null) {
      const characterElement = itemsRef.current.get(Number(selectedCharacterId));
      if (characterElement) {
        characterElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    } else {
      // Scroll to "All" button
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      }
    }
  }, [selectedCharacterId]);

  // Drag and Drop Handlers
  const onDragStart = (e: React.DragEvent, item: Character) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent, targetItem: Character) => {
    e.preventDefault(); 

    if (!draggedItem || draggedItem.character_id === targetItem.character_id) {
      return;
    }

    const fromIndex = localCharacters.findIndex(c => c.character_id === draggedItem.character_id);
    const toIndex = localCharacters.findIndex(c => c.character_id === targetItem.character_id);

    if (fromIndex === -1 || toIndex === -1) {
      return;
    }

    const newList = [...localCharacters];
    newList.splice(fromIndex, 1);
    newList.splice(toIndex, 0, draggedItem);
    setLocalCharacters(newList);
  };

  const onDragEnd = () => {
    setDraggedItem(null);
  };

  return (
    <div className={`relative flex flex-col h-full bg-gray-950 text-gray-300 border-r border-gray-800 flex-shrink-0 transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-72'
    }`}>


      {/* Mobile Close Button */}
      <button
        onClick={onCloseMobile}
        className="lg:hidden absolute top-4 right-4 z-10 p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        aria-label="Close sidebar"
      >
        <X size={20} />
      </button>

      {/* Header Section */}
      <div className={`flex flex-col border-b border-gray-800 bg-gray-900/50 transition-all duration-300`}>

        {/* Collapsed State - Show Current Character & Toggle */}
        {isCollapsed && (
          <div className="hidden lg:flex flex-col items-center gap-3 pt-5 pb-3">
            {/* Toggle Button */}
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                title="展开侧边栏"
              >
                <ChevronRight size={18} />
              </button>
            )}
            
            {/* Current Character Avatar */}
            <button
              onClick={() => selectedCharacterId && onSelectCharacter(selectedCharacterId)}
              className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all ${
                selectedCharacterId === null
                  ? 'border-blue-500 bg-gray-800 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                  : 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'
              }`}
              title={
                selectedCharacterId === null
                  ? 'All Characters'
                  : localCharacters.find(c => c.character_id === selectedCharacterId)?.name
              }
            >
              {selectedCharacterId === null ? (
                <Users size={18} />
              ) : (
                <img
                  src={buildAvatarUrl(localCharacters.find(c => c.character_id === selectedCharacterId)?.avatar) || "https://picsum.photos/200"}
                  alt="Current Character"
                  className="w-full h-full object-cover rounded-full"
                />
              )}
            </button>
          </div>
        )}

        {/* Character Selector - Only visible when expanded */}
        {!isCollapsed && (
          <div className="px-4 pt-5 pb-3">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap overflow-hidden">
                {t('sidebar.characters')}
              </div>
              {onToggleCollapse && (
                <button
                  onClick={onToggleCollapse}
                  className="hidden lg:flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex-shrink-0"
                  title="收起侧边栏"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
            </div>
            <div
              ref={scrollContainerRef}
              className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 scroll-smooth"
            >
              <button
                onClick={() => onSelectCharacter(null)}
                className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all relative group ${selectedCharacterId === null
                  ? 'border-blue-500 bg-gray-800 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                  : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                  }`}
                title="All Characters"
              >
                <Users size={18} />
                {selectedCharacterId === null && (
                  <div className="absolute -bottom-1 w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                )}
              </button>

              {localCharacters.map((char) => {
                const charId = char.character_id;
                return (
                  <button
                    key={charId}
                    ref={(el) => {
                      if (el) {itemsRef.current.set(charId, el);}
                      else {itemsRef.current.delete(charId);}
                    }}
                    draggable
                    onDragStart={(e) => onDragStart(e, char)}
                    onDragOver={(e) => onDragOver(e, char)}
                    onDragEnd={onDragEnd}
                    onClick={() => onSelectCharacter(charId)}
                    className={`flex-shrink-0 w-11 h-11 rounded-full border-2 transition-all relative group overflow-hidden cursor-pointer ${selectedCharacterId === charId
                      ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] scale-105'
                      : 'border-transparent hover:border-gray-600 opacity-80 hover:opacity-100'
                      } ${draggedItem && draggedItem.character_id === charId ? 'opacity-50 scale-90' : ''}`}
                    title={char.name}
                  >
                    <img
                      src={buildAvatarUrl(char.avatar) || "https://picsum.photos/200"}
                      alt={char.name}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                    {selectedCharacterId === charId && (
                      <div className="absolute inset-0 bg-blue-500/10 pointer-events-none"></div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* New Chat Button Area */}
        <div className="px-2 pb-3">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98] overflow-hidden py-2.5 px-3 gap-2 font-medium"
            title={isCollapsed ? t('sidebar.newChat') : ''}
          >
            <Plus size={18} className="flex-shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap">{t('sidebar.newChat')}</span>}
          </button>
        </div>
      </div>

      {/* Conversation List Container - Always present to maintain layout */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1 custom-scrollbar">
        {!isCollapsed && (
          <>
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex justify-between items-center whitespace-nowrap">
              <span className="truncate">{selectedCharacterId ? t('sidebar.characterHistory') : t('sidebar.recentChats')}</span>
              <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full flex-shrink-0">{conversations.length}</span>
            </div>

            {conversations.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-600 italic">
                {t('sidebar.noConversations')}
              </div>
            ) : (
              conversations.map((conv) => {
                const char = characters.find(c => c.character_id === conv.character_id);
                const convId = conv.conversation_id;

                return (
                  <div
                    key={convId}
                    className={`group relative flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors ${activeConversationId === convId && viewMode === 'chat'
                      ? 'bg-gray-800 text-white'
                      : 'hover:bg-gray-800/50 text-gray-400 hover:text-gray-200'
                      }`}
                    onClick={() => {
                      setViewMode('chat');
                      onSelectConversation(convId);
                    }}
                  >
                    {selectedCharacterId === null && char ? (
                      <img src={buildAvatarUrl(char.avatar)} className="w-5 h-5 rounded-full object-cover border border-gray-600 flex-shrink-0 opacity-80" alt="" />
                    ) : (
                      <MessageSquare size={18} className="text-gray-600 group-hover:text-gray-400 shrink-0" />
                    )}

                    <div className="flex-1 truncate text-sm whitespace-nowrap overflow-hidden">
                      {conv.title}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(convId);
                      }}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded transition-all flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* Footer / Settings */}
      <div className="border-t border-gray-800 space-y-1 p-2">
        <button
          onClick={() => setViewMode('admin')}
          className={`w-full flex items-center rounded-lg text-sm transition-colors overflow-hidden py-2 px-3 gap-3 ${
            viewMode === 'admin' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
          }`}
          title={isCollapsed ? t('sidebar.adminDashboard') : ''}
        >
          <LayoutDashboard size={18} className="flex-shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">{t('sidebar.adminDashboard')}</span>}
        </button>

        <button
          onClick={onOpenSettings}
          className="w-full flex items-center rounded-lg text-sm transition-colors overflow-hidden text-gray-400 hover:bg-gray-800/50 hover:text-white py-2 px-3 gap-3"
          title={isCollapsed ? t('sidebar.settings') : ''}
        >
          <Settings size={18} className="flex-shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">{t('sidebar.settings')}</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
