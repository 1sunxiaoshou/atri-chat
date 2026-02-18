import React, { useState } from 'react';
import { Character, Model, VRMModel } from '../../../types';
import { api } from '../../../services/api/index';
import { useLanguage } from '../../../contexts/LanguageContext';
import { ConfirmDialog } from '../../ui';
import { CharacterLibrary } from './CharacterLibrary';
import { CharacterEditor } from './CharacterEditor';

interface AdminCharactersProps {
  characters: Character[];
  models: Model[];
  vrmModels: VRMModel[];
  onRefresh: () => Promise<void>;
}

export const AdminCharacters: React.FC<AdminCharactersProps> = ({
  characters,
  models,
  vrmModels,
  onRefresh
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
        <CharacterLibrary
          characters={characters}
          onEdit={setEditingCharacter}
          onCreate={handleCreate}
          onDelete={handleDelete}
        />
      ) : (
        <CharacterEditor
          character={editingCharacter}
          models={models}
          vrmModels={vrmModels}
          ttsProviders={ttsProviders}
          onSave={handleSave}
          onBack={() => setEditingCharacter(null)}
        />
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
