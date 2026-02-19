import React, { useState, useEffect, useRef } from 'react';
import { Plus, MessageSquare, Settings, LayoutDashboard, Trash2, Users, X, User, PanelLeftClose } from 'lucide-react';
import { Conversation, ViewMode, Character } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { buildAvatarUrl } from '../../utils/url';
import { Button, ConfirmDialog } from '../ui';
import { cn } from '../../utils/cn';

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
  onHideSidebar?: () => void;
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
  onHideSidebar
}) => {
  const { t } = useLanguage();

  const [localCharacters, setLocalCharacters] = useState<Character[]>(characters);
  const [draggedItem, setDraggedItem] = useState<Character | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title?: string;
    description: React.ReactNode;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info' | 'success';
  }>({ isOpen: false, description: '', onConfirm: () => { } });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Map<number, HTMLButtonElement>>(new Map());

  // 同步字符数据
  useEffect(() => {
    setLocalCharacters(prev => {
      const prevMap = new Map(prev.map(c => [c.character_id, c]));
      const newIds = new Set(characters.map(c => c.character_id));
      const existing = prev.filter(c => newIds.has(c.character_id)).map(c => characters.find(nc => nc.character_id === c.character_id) || c);
      const brandNew = characters.filter(c => !prevMap.has(c.character_id));
      return [...existing, ...brandNew];
    });
  }, [characters]);

  // 滚动到选中的角色
  useEffect(() => {
    if (selectedCharacterId !== null) {
      itemsRef.current.get(Number(selectedCharacterId))?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    } else {
      scrollContainerRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [selectedCharacterId]);

  // 拖拽逻辑保持不变
  const onDragStart = (e: React.DragEvent, item: Character) => { setDraggedItem(item); e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver = (e: React.DragEvent, targetItem: Character) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.character_id === targetItem.character_id) return;
    const fromIndex = localCharacters.findIndex(c => c.character_id === draggedItem.character_id);
    const toIndex = localCharacters.findIndex(c => c.character_id === targetItem.character_id);
    if (fromIndex === -1 || toIndex === -1) return;
    const newList = [...localCharacters];
    newList.splice(fromIndex, 1);
    newList.splice(toIndex, 0, draggedItem);
    setLocalCharacters(newList);
  };
  const onDragEnd = () => setDraggedItem(null);

  // --- 组件部分 ---

  const NavItem = ({ icon: Icon, label, active, onClick }: any) => (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group w-full font-medium",
        active
          ? "bg-sidebar-active text-sidebar-active-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-sidebar-hover"
      )}
    >
      <Icon size={18} className="flex-shrink-0" />
      <span className="text-sm whitespace-nowrap">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-full w-full select-none overflow-hidden">
      {/* --- 顶部区域：标题与隐藏按钮 --- */}
      <div className="h-16 md:h-18 flex items-center justify-between px-4">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          {t('sidebar.characters')}
        </span>
        {/* 隐藏按钮：在桌面端显示 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onHideSidebar}
          className="hidden lg:flex h-9 w-9 gap-0 text-muted-foreground hover:text-primary hover:bg-transparent rounded-lg [&_svg]:size-5"
        >
          <PanelLeftClose size={20} />
        </Button>
        {/* 移动端关闭按钮 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onCloseMobile}
          className="lg:hidden h-8 w-8 text-muted-foreground"
        >
          <X size={20} />
        </Button>
      </div>

      {/* --- 角色列表区域 --- */}
      <div className="px-4 pb-3">
        {/* 横向角色滚动条 - 带渐变遮罩 */}
        <div className="relative group">
          {/* 左侧渐变遮罩 - 仅在滚动时显示 */}
          <div className="absolute left-0 top-0 bottom-0 w-6 z-10 bg-gradient-to-r from-sidebar to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* 滚动容器 - 隐藏滚动条 + 滚动捕捉 */}
          <div
            ref={scrollContainerRef}
            className={cn(
              "flex flex-row overflow-x-auto py-1 gap-2 scroll-smooth snap-x snap-mandatory",
              // 隐藏滚动条的关键样式
              "scrollbar-hide",
              "[scrollbar-width:none]", // Firefox
              "[&::-webkit-scrollbar]:hidden" // Chrome/Safari
            )}
            style={{ msOverflowStyle: 'none' }} // IE/Edge
          >
            {/* "All" Button */}
            <button
              onClick={() => onSelectCharacter(null)}
              className={cn(
                "flex-shrink-0 rounded-full flex items-center justify-center transition-all duration-200 relative w-10 h-10 snap-center",
                selectedCharacterId === null
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-2 ring-primary/50"
                  : "bg-muted text-muted-foreground hover:bg-sidebar-hover hover:text-foreground"
              )}
              title="All Characters"
            >
              <Users size={18} />
            </button>

            {/* Character Avatars */}
            {localCharacters.map((char) => {
              const isActive = selectedCharacterId === char.character_id;
              const avatarUrl = buildAvatarUrl(char.avatar);
              return (
                <button
                  key={char.character_id}
                  ref={el => { if (el) itemsRef.current.set(char.character_id, el); }}
                  draggable
                  onDragStart={(e) => onDragStart(e, char)}
                  onDragOver={(e) => onDragOver(e, char)}
                  onDragEnd={onDragEnd}
                  onClick={() => onSelectCharacter(char.character_id)}
                  className={cn(
                    "flex-shrink-0 relative rounded-full overflow-hidden transition-all duration-200 border-2 w-10 h-10 snap-center",
                    isActive
                      ? "border-primary opacity-100 shadow-md shadow-primary/20 scale-105"
                      : "border-transparent opacity-70 hover:opacity-100 hover:border-border",
                    draggedItem?.character_id === char.character_id && 'opacity-30'
                  )}
                  title={char.name}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={char.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <User size={16} className="text-muted-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* 右侧渐变遮罩 - 暗示还有更多内容 */}
          <div className="absolute right-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-l from-sidebar to-transparent pointer-events-none" />
        </div>
      </div>

      {/* --- 新建会话按钮 (突出显示) --- */}
      <div className="px-3 pt-3 pb-2">
        <Button
          onClick={onNewChat}
          disabled={selectedCharacterId === null}
          className={cn(
            "w-full border-0 transition-all duration-200 h-10 justify-center gap-2 rounded-lg",
            selectedCharacterId === null
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/10"
          )}
        >
          <Plus size={18} strokeWidth={2.5} />
          <span className="font-semibold text-sm">
            {selectedCharacterId === null ? t('sidebar.selectCharacterFirst') : t('sidebar.newChat')}
          </span>
        </Button>
      </div>

      {/* --- 会话列表区域 --- */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2">
        <div className="flex items-center justify-between px-1 mb-2 mt-1">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            {t('sidebar.recentChats')}
          </span>
          {conversations.length > 0 && (
            <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-md font-mono min-w-[1.2rem] text-center">
              {conversations.length}
            </span>
          )}
        </div>

        <div className="space-y-1">
          {conversations.length === 0 ? (
            <div className="text-center py-10 opacity-50">
              <MessageSquare size={24} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-xs text-muted-foreground font-medium">{t('sidebar.noConversations')}</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = activeConversationId === conv.conversation_id && viewMode === 'chat';
              const char = characters.find(c => c.character_id === conv.character_id);
              const avatarUrl = char ? buildAvatarUrl(char.avatar) : null;

              return (
                <div
                  key={conv.conversation_id}
                  onClick={() => {
                    setViewMode('chat');
                    onSelectConversation(conv.conversation_id);
                  }}
                  className={cn(
                    "group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 border border-transparent",
                    isActive
                      ? 'bg-sidebar-active text-sidebar-active-foreground border-border/60 shadow-sm'
                      : 'text-muted-foreground hover:bg-sidebar-hover hover:text-foreground'
                  )}
                  title={conv.title}
                >
                  {/* 会话头像：这里强制显示角色头像，以区分不同角色的对话 */}
                  <div className="shrink-0 relative">
                    {char && avatarUrl ? (
                      <img
                        src={avatarUrl}
                        className={cn(
                          "w-6 h-6 rounded-full object-cover ring-1",
                          isActive
                            ? "ring-border opacity-100"
                            : "ring-border opacity-80 group-hover:opacity-100"
                        )}
                        alt=""
                      />
                    ) : (
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center",
                        isActive ? "bg-sidebar-active" : "bg-muted"
                      )}>
                        <MessageSquare size={12} className="text-current opacity-70" />
                      </div>
                    )}
                  </div>

                  <span className="flex-1 text-[13px] truncate font-medium">
                    {conv.title || "New Chat"}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDialog({
                        isOpen: true,
                        title: t('admin.delete'),
                        description: t('sidebar.confirmDeleteConversation'),
                        type: 'danger',
                        onConfirm: () => onDeleteConversation(conv.conversation_id)
                      });
                    }}
                    className={cn(
                      "absolute right-2 p-1.5 opacity-0 group-hover:opacity-100 rounded transition-all",
                      "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    )}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* --- 底部菜单 (Characters, Admin & Settings) --- */}
      <div className="p-3 border-t space-y-1 bg-muted/30 border-sidebar-border">
        <NavItem
          icon={Users}
          label={t('sidebar.characterManagement')}
          active={viewMode === 'characters'}
          onClick={() => setViewMode('characters')}
        />
        <NavItem
          icon={LayoutDashboard}
          label={t('sidebar.adminDashboard')}
          active={viewMode === 'admin'}
          onClick={() => setViewMode('admin')}
        />
        <NavItem
          icon={Settings}
          label={t('sidebar.settings')}
          active={viewMode === 'settings'}
          onClick={onOpenSettings}
        />
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        type={confirmDialog.type}
        confirmText={t('admin.delete')}
        cancelText={t('admin.cancel')}
      />
    </div>
  );
};

export default Sidebar;