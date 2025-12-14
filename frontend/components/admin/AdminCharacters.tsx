import React, { useState } from 'react';
import { Users, Plus, Trash, Save } from 'lucide-react';
import { Character, Model, VRMModel } from '../../types';
import { api } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { AvatarEditor } from '../AvatarEditor';
import { getCharacterId } from '../../utils/helpers';
import { Select } from '../ui';

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
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);
  const [ttsProviders, setTtsProviders] = useState<any[]>([]);

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

  const handleCreateClick = () => {
    const defaultModel = models.filter(m => m.enabled)[0];
    setEditingCharacter({
      id: 0,
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

  const handleSaveCharacter = async () => {
    if (!editingCharacter) return;

    const charId = getCharacterId(editingCharacter);

    if (charId === 0 || !charId) {
      const { id, character_id, ...newCharData } = editingCharacter;
      await api.createCharacter(newCharData);
    } else {
      const originalChar = characters.find(c => getCharacterId(c) === charId);
      if (!originalChar) return;

      const updateData: Partial<Character> = {};

      if (editingCharacter.name !== originalChar.name) {
        updateData.name = editingCharacter.name;
      }
      if (editingCharacter.description !== originalChar.description) {
        updateData.description = editingCharacter.description;
      }
      if (editingCharacter.system_prompt !== originalChar.system_prompt) {
        updateData.system_prompt = editingCharacter.system_prompt;
      }
      if (editingCharacter.primary_model_id !== originalChar.primary_model_id) {
        updateData.primary_model_id = editingCharacter.primary_model_id;
      }
      if (editingCharacter.primary_provider_id !== originalChar.primary_provider_id) {
        updateData.primary_provider_id = editingCharacter.primary_provider_id;
      }
      if (editingCharacter.tts_id !== originalChar.tts_id) {
        updateData.tts_id = editingCharacter.tts_id;
      }
      if (editingCharacter.vrm_model_id !== originalChar.vrm_model_id) {
        updateData.vrm_model_id = editingCharacter.vrm_model_id;
      }
      if (editingCharacter.enabled !== originalChar.enabled) {
        updateData.enabled = editingCharacter.enabled;
      }
      if (editingCharacter.avatar && editingCharacter.avatar !== originalChar.avatar) {
        updateData.avatar = editingCharacter.avatar;
      }

      if (Object.keys(updateData).length > 0) {
        await api.updateCharacter(charId, updateData);
      }
    }

    await onRefresh();
    setEditingCharacter(null);
  };

  const handleDeleteCharacter = async (id: number | string) => {
    if (window.confirm(t('admin.confirmDelete'))) {
      await api.deleteCharacter(id);
      const charId = editingCharacter ? getCharacterId(editingCharacter) : null;
      if (charId === id) {
        setEditingCharacter(null);
      }
      await onRefresh();
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)] animate-fadeIn">
      {/* List */}
      <div className="w-1/3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col shadow-sm">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
          <h4 className="font-semibold text-gray-700 dark:text-gray-300">{t('admin.characterList')}</h4>
          <button
            onClick={handleCreateClick}
            className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors"
            title={t('admin.createCharacter')}
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {characters.map(c => {
            const charId = getCharacterId(c);
            const editingCharId = editingCharacter ? getCharacterId(editingCharacter) : null;
            return (
              <div
                key={charId}
                onClick={() => setEditingCharacter(c)}
                className={`p-4 flex items-center gap-3 cursor-pointer border-l-4 transition-all ${editingCharId === charId ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
              >
                <img src={c.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + c.name} alt={c.name} className="w-10 h-10 rounded-full object-cover bg-gray-200 dark:bg-gray-700" />
                <div className="overflow-hidden flex-1">
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.description || c.primary_model_id}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Form */}
      <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm flex flex-col overflow-y-auto">
        {editingCharacter ? (
          <>
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                {getCharacterId(editingCharacter) === 0 ? t('admin.createCharacter') : t('admin.editCharacter')}
              </h3>
              {getCharacterId(editingCharacter) !== 0 && (
                <button
                  onClick={() => handleDeleteCharacter(getCharacterId(editingCharacter))}
                  className="text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1"
                >
                  <Trash size={14} /> {t('admin.delete')}
                </button>
              )}
            </div>

            <div className="flex items-center gap-6 mb-8">
              <div
                className="relative group cursor-pointer"
                onClick={() => setIsAvatarEditorOpen(true)}
              >
                <img
                  src={editingCharacter.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + editingCharacter.name}
                  className="w-20 h-20 rounded-full object-cover bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 group-hover:border-blue-400 dark:group-hover:border-blue-500 transition-all"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-xs font-medium">{t('admin.clickEdit')}</span>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">{t('admin.name')}</label>
                  <input
                    type="text"
                    value={editingCharacter.name}
                    onChange={(e) => setEditingCharacter({ ...editingCharacter, name: e.target.value })}
                    placeholder="e.g. Coding Assistant"
                    className="text-xl font-bold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 outline-none w-full bg-transparent py-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">{t('admin.description')}</label>
                  <input
                    type="text"
                    value={editingCharacter.description || ''}
                    onChange={(e) => setEditingCharacter({ ...editingCharacter, description: e.target.value })}
                    placeholder="Short description..."
                    className="text-sm text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 outline-none w-full bg-transparent py-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6 flex-1 min-h-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-shrink-0">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('admin.defaultModel')}</label>
                  <Select
                    value={editingCharacter.primary_model_id}
                    onChange={(value) => {
                      const selectedModel = models.find(m => m.model_id === value);
                      setEditingCharacter({
                        ...editingCharacter,
                        primary_model_id: value,
                        primary_provider_id: selectedModel?.provider_id || ''
                      });
                    }}
                    options={models.filter(m => m.enabled).map(m => ({
                      label: m.model_id,
                      value: m.model_id,
                      group: m.provider_id
                    }))}
                    placeholder={t('admin.selectModel')}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('admin.ttsConfig')}</label>
                  <Select
                    value={editingCharacter.tts_id || ''}
                    onChange={(value) => setEditingCharacter({ ...editingCharacter, tts_id: value })}
                    options={[
                      { label: 'None', value: '' },
                      ...ttsProviders.map((p: any) => ({
                        label: p.name || p.id,
                        value: p.id
                      }))
                    ]}
                    placeholder="Select TTS"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">VRM Model</label>
                  <Select
                    value={editingCharacter.vrm_model_id || ''}
                    onChange={(value) => setEditingCharacter({ ...editingCharacter, vrm_model_id: value })}
                    options={[
                      { label: 'None', value: '' },
                      ...vrmModels.map(m => ({
                        label: m.name || m.vrm_model_id,
                        value: m.vrm_model_id
                      }))
                    ]}
                    placeholder="Select VRM Model"
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-[200px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('admin.systemPrompt')}</label>
                <textarea
                  value={editingCharacter.system_prompt}
                  onChange={(e) => setEditingCharacter({ ...editingCharacter, system_prompt: e.target.value })}
                  placeholder="You are a helpful AI assistant..."
                  className="w-full flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg p-4 text-sm font-mono leading-relaxed focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">{t('admin.systemPromptHelp')}</p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 flex-shrink-0">
              <button onClick={() => setEditingCharacter(null)} className="px-6 py-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors">{t('admin.cancel')}</button>
              <button
                onClick={handleSaveCharacter}
                disabled={!editingCharacter.name || !editingCharacter.primary_model_id}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg shadow-blue-600/20 dark:shadow-blue-900/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} /> {getCharacterId(editingCharacter) === 0 ? t('admin.create') : t('admin.save')}
              </button>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
            <Users size={64} className="mb-4 opacity-20" />
            <p>{t('admin.selectChar')}</p>
            <button onClick={handleCreateClick} className="mt-4 text-blue-600 dark:text-blue-400 hover:underline">{t('admin.createNew')}</button>
          </div>
        )}
      </div>

      {/* Avatar Editor Modal */}
      {isAvatarEditorOpen && editingCharacter && (
        <AvatarEditor
          currentAvatar={editingCharacter.avatar || ''}
          onSave={async (avatarUrl) => {
            try {
              let finalAvatarUrl = avatarUrl;

              if (avatarUrl.startsWith('data:')) {
                const response = await fetch(avatarUrl);
                const blob = await response.blob();
                const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
                const result = await api.uploadAvatar(file);
                if (result.code === 200) {
                  finalAvatarUrl = 'http://localhost:8000' + result.data.url;
                } else {
                  alert('头像上传失败');
                  return;
                }
              }

              const charId = getCharacterId(editingCharacter);
              await api.updateCharacter(charId, { avatar: finalAvatarUrl });

              setEditingCharacter({ ...editingCharacter, avatar: finalAvatarUrl });
              await onRefresh();
              setIsAvatarEditorOpen(false);
            } catch (error) {
              console.error('头像保存失败:', error);
              alert('头像保存失败，请重试');
            }
          }}
          onCancel={() => setIsAvatarEditorOpen(false)}
        />
      )}
    </div>
  );
};
