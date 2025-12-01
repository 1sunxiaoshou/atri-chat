import React, { useState, useEffect, useRef } from 'react';
import { Plus, MessageSquare, Settings, LayoutDashboard, Trash2, MoreHorizontal, Users, Globe } from 'lucide-react';
import { Conversation, ViewMode, Character } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { getCharacterId, getConversationId } from '../utils/helpers';

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
  onOpenSettings
}) => {
  const { t, language, setLanguage } = useLanguage();

  // Local state for handling sorting locally (since backend doesn't persist order in this mock)
  const [localCharacters, setLocalCharacters] = useState<Character[]>(characters);
  const [draggedItem, setDraggedItem] = useState<Character | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Map<number, HTMLButtonElement>>(new Map());

  // Sync props to local state while preserving custom order
  useEffect(() => {
    setLocalCharacters(prev => {
      const prevMap = new Map(prev.map(c => [getCharacterId(c), c]));
      const newIds = new Set(characters.map(c => getCharacterId(c)));

      // 1. Keep existing items in their current order (preserve user sort)
      const existing = prev
        .filter(c => newIds.has(getCharacterId(c)))
        .map(c => {
          // Update data if changed (e.g. name/avatar edit)
          const updatedData = characters.find(nc => getCharacterId(nc) === getCharacterId(c));
          return updatedData || c;
        });

      // 2. Append new items
      const brandNew = characters.filter(c => !prevMap.has(getCharacterId(c)));

      return [...existing, ...brandNew];
    });
  }, [characters]);

  // Auto-scroll to selected character
  useEffect(() => {
    if (selectedCharacterId !== null) {
      const el = itemsRef.current.get(Number(selectedCharacterId));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
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
    // Remove default ghost transparency to make it look a bit better if desired, 
    // or just let default behavior happen. 
  };

  const onDragOver = (e: React.DragEvent, targetItem: Character) => {
    e.preventDefault(); // Necessary to allow dropping

    if (!draggedItem || getCharacterId(draggedItem) === getCharacterId(targetItem)) return;

    // Simple swap logic
    const fromIndex = localCharacters.findIndex(c => getCharacterId(c) === getCharacterId(draggedItem));
    const toIndex = localCharacters.findIndex(c => getCharacterId(c) === getCharacterId(targetItem));

    if (fromIndex === -1 || toIndex === -1) return;

    const newList = [...localCharacters];
    newList.splice(fromIndex, 1);
    newList.splice(toIndex, 0, draggedItem);
    setLocalCharacters(newList);
  };

  const onDragEnd = () => {
    setDraggedItem(null);
  };

  return (
    <div className="flex flex-col h-full w-72 bg-gray-900 text-gray-300 border-r border-gray-800 flex-shrink-0 transition-all duration-300">

      {/* Header Section */}
      <div className="flex flex-col border-b border-gray-800 bg-gray-900/50">

        {/* Character Selector */}
        <div className="px-4 pt-5 pb-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
            {t('sidebar.characters')}
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
              const charId = getCharacterId(char);
              return (
                <button
                  key={charId}
                  ref={(el) => {
                    if (el) itemsRef.current.set(charId, el);
                    else itemsRef.current.delete(charId);
                  }}
                  draggable
                  onDragStart={(e) => onDragStart(e, char)}
                  onDragOver={(e) => onDragOver(e, char)}
                  onDragEnd={onDragEnd}
                  onClick={() => onSelectCharacter(charId)}
                  className={`flex-shrink-0 w-11 h-11 rounded-full border-2 transition-all relative group overflow-hidden cursor-pointer ${selectedCharacterId === charId
                    ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] scale-105'
                    : 'border-transparent hover:border-gray-600 opacity-80 hover:opacity-100'
                    } ${draggedItem && getCharacterId(draggedItem) === charId ? 'opacity-50 scale-90' : ''}`}
                  title={char.name}
                >
                  <img
                    src={char.avatar || "https://picsum.photos/200"}
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

        {/* New Chat Button */}
        <div className="px-4 pb-4">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-lg transition-all font-medium shadow-lg shadow-blue-900/20 active:scale-[0.98]"
          >
            <Plus size={18} />
            {t('sidebar.newChat')}
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1 custom-scrollbar">
        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex justify-between items-center">
          <span>{selectedCharacterId ? t('sidebar.characterHistory') : t('sidebar.recentChats')}</span>
          <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full">{conversations.length}</span>
        </div>

        {conversations.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-600 italic">
            {t('sidebar.noConversations')}
          </div>
        ) : (
          conversations.map((conv) => {
            // Find character for this conversation to display avatar small icon if "All" is selected
            const char = characters.find(c => getCharacterId(c) === Number(conv.character_id));
            const convId = getConversationId(conv);

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
                {/* Show character mini-avatar if viewing All, else generic icon */}
                {selectedCharacterId === null && char ? (
                  <img src={char.avatar} className="w-5 h-5 rounded-full object-cover border border-gray-600 flex-shrink-0 opacity-80" alt="" />
                ) : (
                  <MessageSquare size={18} className="text-gray-600 group-hover:text-gray-400 shrink-0" />
                )}

                <div className="flex-1 truncate text-sm">
                  {conv.title}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(convId);
                  }}
                  className="absolute right-2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer / Settings */}
      <div className="p-4 border-t border-gray-800 space-y-1">
        <button
          onClick={() => setViewMode('admin')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${viewMode === 'admin' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
            }`}
        >
          <LayoutDashboard size={18} />
          {t('sidebar.adminDashboard')}
        </button>

        {/* Language Switcher */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800/50 hover:text-white transition-colors"
        >
          <Globe size={18} />
          {language === 'en' ? '中文' : 'English'}
        </button>

        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800/50 hover:text-white transition-colors"
        >
          <Settings size={18} />
          {t('sidebar.settings')}
        </button>

        <div className="mt-2 pt-3 border-t border-gray-800 flex items-center gap-3 px-1">
          <img
            src="https://picsum.photos/seed/user/40/40"
            alt="User"
            className="w-8 h-8 rounded-full border border-gray-600"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Demo User</p>
            <p className="text-xs text-gray-500 truncate">Pro Plan</p>
          </div>
          <MoreHorizontal size={16} className="text-gray-500 cursor-pointer hover:text-white" />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;