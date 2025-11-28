import React, { useState, useEffect } from 'react';
import { Server, Cpu, Users, Plus, Trash, Save, X, CheckCircle, RotateCcw } from 'lucide-react';
import { Provider, Model, Character, AdminTab } from '../types';
import { api } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { AvatarEditor } from './AvatarEditor';

interface AdminDashboardProps {
  onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<AdminTab>('providers');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);

  // Helper function to get character ID (supports both character_id and id)
  const getCharacterId = (char: Character): number => {
    return (char.character_id || char.id || 0) as number;
  };

  // Provider Modal State
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Partial<Provider> | null>(null);

  // Model Modal State
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [newModel, setNewModel] = useState<Partial<Model>>({ capabilities: ['chat'] });

  // Model Filter State
  const [modelFilterProvider, setModelFilterProvider] = useState<string>('');
  const [modelFilterType, setModelFilterType] = useState<string>('');
  const [modelFilterEnabled, setModelFilterEnabled] = useState<string>('');

  // Character Edit State
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const p = await api.getProviders();
    const m = await api.getModels();
    const c = await api.getCharacters();
    setProviders(p.data);
    setModels(m.data);
    setCharacters(c.data);
  };

  // --- Provider Handlers ---
  const handleOpenProviderModal = (provider?: Provider) => {
    if (provider) {
      setEditingProvider({ ...provider });
    } else {
      setEditingProvider({
        provider_id: '',
        name: '',
        template_type: 'openai',
        description: '',
        config_json: { api_key: '', base_url: '' }
      });
    }
    setIsProviderModalOpen(true);
  };

  const handleSaveProvider = async () => {
    if (!editingProvider || !editingProvider.provider_id || !editingProvider.name) return;

    const existing = providers.find(p => p.provider_id === editingProvider.provider_id);

    if (existing) {
      // 更新
      await api.updateProvider(editingProvider.provider_id, {
        name: editingProvider.name,
        config_json: editingProvider.config_json
      });
    } else {
      // 创建
      await api.createProvider(editingProvider as Provider);
    }

    setIsProviderModalOpen(false);
    await fetchData();
  };

  const handleDeleteProvider = async (id: string) => {
    if (window.confirm(t('admin.confirmDeleteProvider'))) {
      await api.deleteProvider(id);
      await fetchData();
    }
  };

  // --- Model Handlers ---
  const handleOpenModelModal = () => {
    setNewModel({
      provider_id: providers[0]?.provider_id || '',
      model_id: '',
      model_type: 'text',
      capabilities: ['chat'],
      enabled: true
    });
    setIsModelModalOpen(true);
  };

  const handleSaveModel = async () => {
    if (!newModel.provider_id || !newModel.model_id) return;
    await api.createModel(newModel as Model);
    setIsModelModalOpen(false);
    await fetchData();
  };

  const handleDeleteModel = async (providerId: string, modelId: string) => {
    if (window.confirm(t('admin.confirmDeleteModel'))) {
      await api.deleteModel(providerId, modelId);
      await fetchData();
    }
  };


  // --- Character Handlers ---
  const handleCreateClick = () => {
    const defaultModel = models.filter(m => m.enabled)[0];
    setEditingCharacter({
      id: 0, // 0 indicates new character
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
      // Create new - exclude id and character_id fields
      const { id, character_id, ...newCharData } = editingCharacter;
      await api.createCharacter(newCharData);
    } else {
      // Update existing - only send fields that have actual values
      const originalChar = characters.find(c => getCharacterId(c) === charId);
      if (!originalChar) return;

      // Build update object with only changed fields
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
      if (editingCharacter.enabled !== originalChar.enabled) {
        updateData.enabled = editingCharacter.enabled;
      }
      if (editingCharacter.avatar && editingCharacter.avatar !== originalChar.avatar) {
        updateData.avatar = editingCharacter.avatar;
      }

      // Only call API if there are actual changes
      if (Object.keys(updateData).length > 0) {
        await api.updateCharacter(charId, updateData);
      }
    }

    await fetchData();
    setEditingCharacter(null);
  };

  const handleDeleteCharacter = async (id: number | string) => {
    if (window.confirm(t('admin.confirmDelete'))) {
      await api.deleteCharacter(id);
      const charId = editingCharacter ? getCharacterId(editingCharacter) : null;
      if (charId === id) {
        setEditingCharacter(null);
      }
      await fetchData();
    }
  };

  const renderProviders = () => (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-800">{t('admin.providers')}</h3>
        <button
          onClick={() => handleOpenProviderModal()}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} /> {t('admin.addProvider')}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {providers.map((p) => (
          <div key={p.provider_id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 text-blue-500">
              <CheckCircle size={18} />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100">
                {p.logo ? (
                  <img src={p.logo.startsWith('http') ? p.logo : 'http://localhost:8000' + p.logo} alt={p.name} className="w-full h-full object-contain rounded-lg" />
                ) : (
                  <Server size={20} className="text-gray-600" />
                )}
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">{p.name}</h4>
                <span className="text-xs text-gray-500 uppercase tracking-wide bg-gray-100 px-2 py-0.5 rounded-full">{p.template_type}</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6 min-h-[40px]">{p.description || "No description provided."}</p>
            <div className="space-y-3">
              {Object.keys(p.config_json).slice(0, 2).map(key => (
                <div key={key} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                  <span className="text-gray-500 capitalize">{key.replace('_', ' ')}</span>
                  <span className="font-mono text-gray-700 truncate max-w-[120px]">
                    {key.includes('key') ? '••••••••' : p.config_json[key]}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => handleOpenProviderModal(p)}
                className="flex-1 text-sm border border-gray-200 rounded-lg py-2 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteProvider(p.provider_id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
              >
                <Trash size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderModels = () => {
    // 筛选模型
    const filteredModels = models.filter(m => {
      if (modelFilterProvider && m.provider_id !== modelFilterProvider) return false;
      if (modelFilterType && m.model_type !== modelFilterType) return false;
      if (modelFilterEnabled === 'enabled' && !m.enabled) return false;
      if (modelFilterEnabled === 'disabled' && m.enabled) return false;
      return true;
    });

    return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-800">{t('admin.models')}</h3>
        <div className="flex gap-2">
          <button
            onClick={handleOpenModelModal}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} /> {t('admin.addModel')}
          </button>
          <button className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors text-sm font-medium border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50">
            <RotateCcw size={16} /> {t('admin.syncModels')}
          </button>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex gap-4 items-center">
          <span className="text-sm font-medium text-gray-700">筛选:</span>
          <select
            value={modelFilterProvider}
            onChange={(e) => setModelFilterProvider(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">所有供应商</option>
            {[...new Set(models.map(m => m.provider_id))].map(pid => (
              <option key={pid} value={pid}>{pid}</option>
            ))}
          </select>
          <select
            value={modelFilterType}
            onChange={(e) => setModelFilterType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">所有类型</option>
            <option value="text">Text</option>
            <option value="embedding">Embedding</option>
          </select>
          <select
            value={modelFilterEnabled}
            onChange={(e) => setModelFilterEnabled(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">所有状态</option>
            <option value="enabled">已启用</option>
            <option value="disabled">已禁用</option>
          </select>
          {(modelFilterProvider || modelFilterType || modelFilterEnabled) && (
            <button
              onClick={() => {
                setModelFilterProvider('');
                setModelFilterType('');
                setModelFilterEnabled('');
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              清除筛选
            </button>
          )}
          <span className="text-sm text-gray-500 ml-auto">
            显示 {filteredModels.length} / {models.length} 个模型
          </span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
            <tr>
              <th className="px-6 py-4">Model ID</th>
              <th className="px-6 py-4">Provider</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Capabilities</th>
              <th className="px-6 py-4 text-right">Status</th>
              <th className="px-6 py-4 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredModels.map((m) => (
              <tr key={`${m.provider_id}-${m.model_id}`} className="hover:bg-gray-50/50 transition-colors group">
                <td className="px-6 py-4 font-medium text-gray-900">{m.model_id}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    {m.provider_id}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">{m.model_type}</td>
                <td className="px-6 py-4 text-gray-500 flex gap-1">
                  {m.capabilities.map(cap => (
                    <span key={cap} className="px-2 py-0.5 bg-gray-100 rounded text-xs">{cap}</span>
                  ))}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => api.toggleModel(m.model_id, !m.enabled, m.provider_id).then(fetchData)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${m.enabled ? 'bg-green-500' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${m.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleDeleteModel(m.provider_id, m.model_id)}
                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    );
  };

  const renderCharacters = () => (
    <div className="flex gap-6 h-[calc(100vh-200px)] animate-fadeIn">
      {/* List */}
      <div className="w-1/3 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h4 className="font-semibold text-gray-700">{t('admin.characterList')}</h4>
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
                className={`p-4 flex items-center gap-3 cursor-pointer border-l-4 transition-all ${editingCharId === charId ? 'bg-blue-50 border-blue-500' : 'border-transparent hover:bg-gray-50'}`}
              >
                <img src={c.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + c.name} alt={c.name} className="w-10 h-10 rounded-full object-cover bg-gray-200" />
                <div className="overflow-hidden flex-1">
                  <p className="font-medium text-gray-900 truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 truncate">{c.description || c.primary_model_id}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Form */}
      <div className="flex-1 bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col overflow-y-auto">
        {editingCharacter ? (
          <>
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-lg font-bold text-gray-800">
                {getCharacterId(editingCharacter) === 0 ? t('admin.createCharacter') : t('admin.editCharacter')}
              </h3>
              {getCharacterId(editingCharacter) !== 0 && (
                <button
                  onClick={() => handleDeleteCharacter(getCharacterId(editingCharacter))}
                  className="text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1"
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
                  className="w-20 h-20 rounded-full object-cover bg-gray-100 border-2 border-gray-200 group-hover:border-blue-400 transition-all" 
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-xs font-medium">点击编辑</span>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{t('admin.name')}</label>
                  <input
                    type="text"
                    value={editingCharacter.name}
                    onChange={(e) => setEditingCharacter({ ...editingCharacter, name: e.target.value })}
                    placeholder="e.g. Coding Assistant"
                    className="text-xl font-bold text-gray-900 border-b border-gray-200 focus:border-blue-500 outline-none w-full bg-transparent py-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{t('admin.description')}</label>
                  <input
                    type="text"
                    value={editingCharacter.description || ''}
                    onChange={(e) => setEditingCharacter({ ...editingCharacter, description: e.target.value })}
                    placeholder="Short description..."
                    className="text-sm text-gray-600 border-b border-gray-200 focus:border-blue-500 outline-none w-full bg-transparent py-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6 flex-1 min-h-0">
              <div className="grid grid-cols-2 gap-4 flex-shrink-0">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.defaultModel')}</label>
                  <select
                    value={editingCharacter.primary_model_id}
                    onChange={(e) => {
                      const selectedModel = models.find(m => m.model_id === e.target.value);
                      setEditingCharacter({
                        ...editingCharacter,
                        primary_model_id: e.target.value,
                        primary_provider_id: selectedModel?.provider_id || ''
                      });
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {models.filter(m => m.enabled).map(m => (
                      <option key={m.model_id} value={m.model_id}>{m.model_id} ({m.provider_id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.ttsConfig')}</label>
                  <input
                    type="text"
                    value={editingCharacter.tts_id || ''}
                    onChange={(e) => setEditingCharacter({ ...editingCharacter, tts_id: e.target.value })}
                    placeholder="e.g. tts_001"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.systemPrompt')}</label>
                <textarea
                  value={editingCharacter.system_prompt}
                  onChange={(e) => setEditingCharacter({ ...editingCharacter, system_prompt: e.target.value })}
                  placeholder="You are a helpful AI assistant..."
                  className="w-full flex-1 bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm font-mono leading-relaxed focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
                <p className="text-xs text-gray-400 mt-2 text-right">{t('admin.systemPromptHelp')}</p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
              <button onClick={() => setEditingCharacter(null)} className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">{t('admin.cancel')}</button>
              <button
                onClick={handleSaveCharacter}
                disabled={!editingCharacter.name || !editingCharacter.primary_model_id}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} /> {getCharacterId(editingCharacter) === 0 ? t('admin.create') : t('admin.save')}
              </button>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <Users size={64} className="mb-4 opacity-20" />
            <p>{t('admin.selectChar')}</p>
            <button onClick={handleCreateClick} className="mt-4 text-blue-600 hover:underline">{t('admin.createNew')}</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-gray-50/50 relative">
      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-8 pt-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('admin.title')}</h2>
        <div className="flex gap-8">
          {[
            { id: 'providers', label: t('admin.providers'), icon: Server },
            { id: 'models', label: t('admin.models'), icon: Cpu },
            { id: 'characters', label: t('admin.characters'), icon: Users },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`pb-4 px-2 flex items-center gap-2 font-medium transition-all relative ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <tab.icon size={18} />
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'providers' && renderProviders()}
          {activeTab === 'models' && renderModels()}
          {activeTab === 'characters' && renderCharacters()}
        </div>
      </div>

      {/* Provider Modal */}
      {isProviderModalOpen && editingProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn scale-95 opacity-0 fill-mode-forwards" style={{ animation: 'fadeInScale 0.2s forwards' }}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 text-lg">
                {editingProvider.provider_id ? t('admin.editProvider') : t('admin.addProvider')}
              </h3>
              <button onClick={() => setIsProviderModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Core Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('admin.providerId')}</label>
                  <input
                    type="text"
                    value={editingProvider.provider_id}
                    onChange={(e) => setEditingProvider({ ...editingProvider, provider_id: e.target.value })}
                    disabled={providers.some(p => p.provider_id === editingProvider.provider_id && editingProvider !== p)} // Crude check if existing logic
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. deepseek"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">供应商模板</label>
                  <select
                    value={editingProvider.template_type || 'openai'}
                    onChange={(e) => setEditingProvider({ ...editingProvider, template_type: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="openai">OpenAI 兼容</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="google">Google (Gemini)</option>
                    <option value="tongyi">通义千问</option>
                    <option value="local">本地模型 (Ollama)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('admin.providerName')}</label>
                <input
                  type="text"
                  value={editingProvider.name || ''}
                  onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Display Name"
                />
              </div>

              {/* Config JSON Fields */}
              <div className="pt-2 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Configuration</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t('admin.apiKey')}</label>
                    <input
                      type="password"
                      value={editingProvider.config_json?.api_key || ''}
                      onChange={(e) => setEditingProvider({
                        ...editingProvider,
                        config_json: { ...editingProvider.config_json, api_key: e.target.value }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                      placeholder="sk-..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t('admin.baseUrl')}</label>
                    <input
                      type="text"
                      value={editingProvider.config_json?.base_url || ''}
                      onChange={(e) => setEditingProvider({
                        ...editingProvider,
                        config_json: { ...editingProvider.config_json, base_url: e.target.value }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                      placeholder="https://api..."
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setIsProviderModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
                {t('admin.cancel')}
              </button>
              <button
                onClick={handleSaveProvider}
                disabled={!editingProvider.provider_id}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('admin.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Model Modal */}
      {isModelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn scale-95 opacity-0 fill-mode-forwards" style={{ animation: 'fadeInScale 0.2s forwards' }}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 text-lg">{t('admin.addModel')}</h3>
              <button onClick={() => setIsModelModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('admin.providers')}</label>
                <select
                  value={newModel.provider_id}
                  onChange={(e) => setNewModel({ ...newModel, provider_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {providers.map(p => (
                    <option key={p.provider_id} value={p.provider_id}>{p.name || p.provider_id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('admin.modelId')}</label>
                <input
                  type="text"
                  value={newModel.model_id || ''}
                  onChange={(e) => setNewModel({ ...newModel, model_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. gpt-4-turbo"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('admin.modelType')}</label>
                <select
                  value={newModel.model_type}
                  onChange={(e) => setNewModel({ ...newModel, model_type: e.target.value as 'text' | 'embedding' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="text">Text (Chat)</option>
                  <option value="embedding">Embedding</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">{t('admin.capabilities')}</label>
                <div className="flex gap-4">
                  {['chat', 'completion', 'function_calling'].map(cap => (
                    <label key={cap} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newModel.capabilities?.includes(cap)}
                        onChange={(e) => {
                          const caps = newModel.capabilities || [];
                          if (e.target.checked) {
                            setNewModel({ ...newModel, capabilities: [...caps, cap] });
                          } else {
                            setNewModel({ ...newModel, capabilities: caps.filter(c => c !== cap) });
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 capitalize">{cap.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setIsModelModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
                {t('admin.cancel')}
              </button>
              <button
                onClick={handleSaveModel}
                disabled={!newModel.model_id}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('admin.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Avatar Editor Modal */}
      {isAvatarEditorOpen && editingCharacter && (
        <AvatarEditor
          currentAvatar={editingCharacter.avatar || ''}
          onSave={async (avatarUrl) => {
            try {
              let finalAvatarUrl = avatarUrl;
              
              // 如果是本地文件（base64），需要上传
              if (avatarUrl.startsWith('data:')) {
                // 将base64转换为文件并上传
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
              
              // 立即调用 API 更新角色头像
              const charId = getCharacterId(editingCharacter);
              await api.updateCharacter(charId, { avatar: finalAvatarUrl });
              
              // 更新本地状态
              setEditingCharacter({ ...editingCharacter, avatar: finalAvatarUrl });
              
              // 刷新数据
              await fetchData();
              
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

export default AdminDashboard;