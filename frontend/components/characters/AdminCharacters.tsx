import React, { useState } from 'react';
import { Plus, Menu, PanelLeftOpen } from 'lucide-react';
import { Character, Model, VRMModel } from '../../types';
import { api } from '../../services/api/index';
import { useLanguage } from '../../contexts/LanguageContext';
import { ConfirmDialog, Button } from '../ui';
import { CharacterLibrary } from './CharacterLibrary';
import { CharacterEditor } from './CharacterEditor';
import { cn } from '../../utils/cn';

interface AdminCharactersProps {
  characters: Character[];
  models: Model[];
  vrmModels: VRMModel[];
  onRefresh: () => Promise<void>;
  onOpenMobileSidebar?: () => void;
  isSidebarHidden?: boolean;
  onShowSidebar?: () => void;
}

export const AdminCharacters: React.FC<AdminCharactersProps> = ({
  characters,
  models,
  vrmModels,
  onRefresh,
  onOpenMobileSidebar,
  isSidebarHidden,
  onShowSidebar
}) => {
  const { t } = useLanguage();
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [ttsProviders, setTtsProviders] = useState<any[]>([]);
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

  React.useEffect(() => {
    fetchTTSProviders();
  }, []);

  const fetchTTSProviders = async () => {
    try {
      const res = await api.getTTSProviders();
      if (res.code === 200) {
        if (Array.isArray(res.data)) {
          setTtsProviders(res.data);
        } else if (res.data && Array.isArray(res.data.providers)) {
          setTtsProviders(res.data.providers);
        }
      }
    } catch (error) {
      console.error('Failed to fetch TTS providers', error);
    }
  };

  const handleCreate = () => {
    const defaultModel = models.filter(m => m.enabled)[0];
    setEditingCharacter({
      character_id: 0,
      name: '',
      description: '',
      system_prompt: '',
      primary_model_id: defaultModel?.model_id || '',
      primary_provider_id: defaultModel?.provider_id || '',
      tts_id: '',
      enabled: true,
      avatar: ''
    });
  };

  const handleSave = async (character: Character) => {
    const charId = character.character_id;

    if (charId === 0 || !charId) {
      const { character_id: _character_id, ...newCharData } = character;
      await api.createCharacter(newCharData);
    } else {
      const originalChar = characters.find(c => c.character_id === charId);
      if (!originalChar) return;

      const updateData: Partial<Character> = {};
      if (character.name !== originalChar.name) updateData.name = character.name;
      if (character.description !== originalChar.description) updateData.description = character.description;
      if (character.system_prompt !== originalChar.system_prompt) updateData.system_prompt = character.system_prompt;
      if (character.primary_model_id !== originalChar.primary_model_id) updateData.primary_model_id = character.primary_model_id;
      if (character.primary_provider_id !== originalChar.primary_provider_id) updateData.primary_provider_id = character.primary_provider_id;
      if (character.tts_id !== originalChar.tts_id) updateData.tts_id = character.tts_id;
      if (character.vrm_model_id !== originalChar.vrm_model_id) updateData.vrm_model_id = character.vrm_model_id;
      if (character.enabled !== originalChar.enabled) updateData.enabled = character.enabled;
      if (character.avatar && character.avatar !== originalChar.avatar) updateData.avatar = character.avatar;

      if (Object.keys(updateData).length > 0) {
        await api.updateCharacter(charId, updateData);
      }
    }

    await onRefresh();
    setEditingCharacter(null);
  };

  const handleDelete = async (id: number | string) => {
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
                    title="显示侧边栏"
                  >
                    <PanelLeftOpen size={20} />
                  </Button>
                </div>

                <h2 className={cn(
                  "text-2xl font-bold tracking-tight text-foreground transition-all duration-300",
                  !isSidebarHidden && "lg:ml-2"
                )}>{t('sidebar.characterManagement')}</h2>

                <span className="ml-3 px-2.5 py-0.5 rounded-full bg-muted text-xs text-muted-foreground font-medium border border-border">
                  {characters.length} {t('admin.modelsCount').replace('模型', '角色').replace('models', 'characters')}
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
            vrmModels={vrmModels}
            ttsProviders={ttsProviders}
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
