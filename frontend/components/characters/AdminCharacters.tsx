import React, { useState } from 'react';
import { Plus, Menu, PanelLeftOpen } from 'lucide-react';
import { Character, Model } from '../../types';
import { api } from '../../services/api/index';
import { useLanguage } from '../../contexts/LanguageContext';
import { ConfirmDialog, Button } from '../ui';
import { CharacterLibrary } from './library';
import { CharacterEditor } from './editor';
import { cn } from '../../utils/cn';

interface AdminCharactersProps {
  characters: Character[];
  models: Model[];
  onRefresh: () => Promise<void>;
  onOpenMobileSidebar?: () => void;
  isSidebarHidden?: boolean;
  onShowSidebar?: () => void;
}

export const AdminCharacters: React.FC<AdminCharactersProps> = ({
  characters,
  models,
  onRefresh,
  onOpenMobileSidebar,
  isSidebarHidden,
  onShowSidebar
}) => {
  const { t } = useLanguage();
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title?: string;
    description: React.ReactNode;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info' | 'success';
  }>({
    isOpen: false,
    description: '',
    onConfirm: () => { }
  });

  const handleCreate = () => {
    const defaultModel = models.filter(m => m.enabled)[0];
    setEditingCharacter({
      id: '', // 空字符串表示新建
      name: '',
      system_prompt: t('character.defaultSystemPrompt'), // 提供默认系统提示词
      primary_model_id: defaultModel?.id || '', // 使用 UUID 而不是 model_id
      primary_provider_id: defaultModel?.provider_id || '',
      avatar_id: '',
      voice_asset_id: '',
      enabled: true
    });
  };

  const handleSave = async (character: Character, motionBindings?: any[]) => {
    if (!character.id) {
      // 创建新角色
      const { id, created_at, updated_at, avatar, voice_asset, primary_model, ...newCharData } = character;

      // 清理空字符串字段，避免后端验证失败
      const cleanedData: any = { ...newCharData };

      // 清理所有空字符串和 undefined 字段
      if (!cleanedData.avatar_id) {
        delete cleanedData.avatar_id;
      }
      if (!cleanedData.voice_asset_id) {
        delete cleanedData.voice_asset_id;
      }
      if (!cleanedData.voice_speaker_id) {
        delete cleanedData.voice_speaker_id;
      }
      if (!cleanedData.primary_model_id) {
        delete cleanedData.primary_model_id;
      }
      if (!cleanedData.primary_provider_id) {
        delete cleanedData.primary_provider_id;
      }
      if (!cleanedData.portrait_url) {
        delete cleanedData.portrait_url;
      }

      // 如果有动作绑定，添加到请求数据中
      const createData = motionBindings && motionBindings.length > 0
        ? { ...cleanedData, motion_bindings: motionBindings }
        : cleanedData;

      await api.createCharacter(createData);
    } else {
      // 更新现有角色
      const originalChar = characters.find(c => c.id === character.id);
      if (!originalChar) return;

      const updateData: Partial<Character> = {};
      if (character.name !== originalChar.name) updateData.name = character.name;
      if (character.system_prompt !== originalChar.system_prompt) updateData.system_prompt = character.system_prompt;
      if (character.primary_model_id !== originalChar.primary_model_id) updateData.primary_model_id = character.primary_model_id;
      if (character.primary_provider_id !== originalChar.primary_provider_id) updateData.primary_provider_id = character.primary_provider_id;
      if (character.avatar_id !== originalChar.avatar_id) updateData.avatar_id = character.avatar_id;
      if (character.voice_asset_id !== originalChar.voice_asset_id) updateData.voice_asset_id = character.voice_asset_id;
      if (character.portrait_url !== originalChar.portrait_url) updateData.portrait_url = character.portrait_url;
      if (character.enabled !== originalChar.enabled) updateData.enabled = character.enabled;

      if (Object.keys(updateData).length > 0) {
        await api.updateCharacter(character.id, updateData);
      }
    }

    await onRefresh();
    setEditingCharacter(null);
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t('admin.delete'),
      description: t('admin.confirmDelete'),
      type: 'danger',
      onConfirm: async () => {
        await api.deleteCharacter(id);
        await onRefresh();
      }
    });
  };

  return (
    <>
      {!editingCharacter ? (
        <div className="flex flex-col h-full bg-muted/30 relative">
          {/* Header */}
          <header className="bg-background border-b border-border px-4 lg:px-2">
            <div className="h-16 md:h-18 flex items-center justify-between">
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpenMobileSidebar}
                  className="lg:hidden"
                  aria-label="Open menu"
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
                )}>{t('sidebar.characterManagement')}</h2>

                <span className="ml-3 px-2.5 py-0.5 rounded-full bg-muted text-xs text-muted-foreground font-medium border border-border">
                  {characters.length} {t('admin.charactersCount')}
                </span>
              </div>

              <Button onClick={handleCreate} size="default" className="mr-2">
                <Plus size={16} />
                {t('admin.createCharacter')}
              </Button>
            </div>
          </header>

          {/* Content Area */}
          <main className="flex-1 overflow-hidden">
            <CharacterLibrary
              characters={characters}
              onEdit={setEditingCharacter}
              onCreate={handleCreate}
              onDelete={handleDelete}
              hideHeader={true}
            />
          </main>
        </div>
      ) : (
        <div className="h-full">
          <CharacterEditor
            character={editingCharacter}
            models={models}
            onSave={handleSave}
            onBack={() => setEditingCharacter(null)}
          />
        </div>
      )}

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
    </>
  );
};
