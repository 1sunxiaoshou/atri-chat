import React, { useState } from 'react';
import { Plus, Trash, RotateCcw, X } from 'lucide-react';
import { Provider, Model } from '../../types';
import { api } from '../../services/api/index';
import { useLanguage } from '../../contexts/LanguageContext';
import { Select } from '../ui';

interface AdminModelsProps {
  providers: Provider[];
  models: Model[];
  onRefresh: () => Promise<void>;
}

export const AdminModels: React.FC<AdminModelsProps> = ({
  providers,
  models,
  onRefresh
}) => {
  const { t } = useLanguage();
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [newModel, setNewModel] = useState<Partial<Model>>({ capabilities: ['base'] });
  const [modelFilterProvider, setModelFilterProvider] = useState<string>('');
  const [modelFilterType, setModelFilterType] = useState<string>('');
  const [modelFilterEnabled, setModelFilterEnabled] = useState<string>('');

  const handleOpenModelModal = () => {
    setNewModel({
      provider_id: providers[0]?.provider_id || '',
      model_id: '',
      model_type: 'text',
      capabilities: ['base'],
      enabled: true
    });
    setIsModelModalOpen(true);
  };

  const handleSaveModel = async () => {
    if (!newModel.provider_id || !newModel.model_id) {return;}
    await api.createModel(newModel as Model);
    setIsModelModalOpen(false);
    await onRefresh();
  };

  const handleDeleteModel = async (providerId: string, modelId: string) => {
    if (window.confirm(t('admin.confirmDeleteModel'))) {
      await api.deleteModel(providerId, modelId);
      await onRefresh();
    }
  };

  const filteredModels = models.filter(m => {
    if (modelFilterProvider && m.provider_id !== modelFilterProvider) {return false;}
    if (modelFilterType && m.model_type !== modelFilterType) {return false;}
    if (modelFilterEnabled === 'enabled' && !m.enabled) {return false;}
    if (modelFilterEnabled === 'disabled' && m.enabled) {return false;}
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{t('admin.models')}</h3>
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
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
        <div className="flex gap-4 items-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.filter')}:</span>
          <Select
            value={modelFilterProvider}
            onChange={setModelFilterProvider}
            options={[
              { label: t('admin.allProviders'), value: '' },
              ...[...new Set(models.map(m => m.provider_id))].map(pid => ({
                label: pid,
                value: pid
              }))
            ]}
            placeholder={t('admin.allProviders')}
            className="min-w-[160px]"
          />
          <Select
            value={modelFilterType}
            onChange={setModelFilterType}
            options={[
              { label: t('admin.allTypes'), value: '' },
              { label: 'Text', value: 'text' },
              { label: 'Embedding', value: 'embedding' }
            ]}
            placeholder={t('admin.allTypes')}
            className="min-w-[140px]"
          />
          <Select
            value={modelFilterEnabled}
            onChange={setModelFilterEnabled}
            options={[
              { label: t('admin.allStatus'), value: '' },
              { label: t('admin.enabled'), value: 'enabled' },
              { label: t('admin.disabled'), value: 'disabled' }
            ]}
            placeholder={t('admin.allStatus')}
            className="min-w-[140px]"
          />
          {(modelFilterProvider || modelFilterType || modelFilterEnabled) && (
            <button
              onClick={() => {
                setModelFilterProvider('');
                setModelFilterType('');
                setModelFilterEnabled('');
              }}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline"
            >
              {t('admin.clearFilter')}
            </button>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
            {t('admin.showing')} {filteredModels.length} {t('admin.of')} {models.length} {t('admin.modelsCount')}
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-6 py-4">{t('admin.modelId')}</th>
              <th className="px-6 py-4">{t('admin.providers')}</th>
              <th className="px-6 py-4">{t('admin.modelType')}</th>
              <th className="px-6 py-4">{t('admin.capabilities')}</th>
              <th className="px-6 py-4 text-right">{t('admin.status')}</th>
              <th className="px-6 py-4 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredModels.map((m) => (
              <tr key={`${m.provider_id}-${m.model_id}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{m.model_id}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    {m.provider_id}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{m.model_type}</td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-400 flex gap-1">
                  {m.capabilities.map(cap => (
                    <span key={cap} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">{cap}</span>
                  ))}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => api.toggleModel(m.model_id, !m.enabled, m.provider_id).then(onRefresh)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${m.enabled ? 'bg-green-500' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${m.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleDeleteModel(m.provider_id, m.model_id)}
                    className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Model Modal */}
      {isModelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn scale-95 opacity-0 fill-mode-forwards" style={{ animation: 'fadeInScale 0.2s forwards' }}>
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-lg">{t('admin.addModel')}</h3>
              <button onClick={() => setIsModelModalOpen(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">{t('admin.providers')}</label>
                <Select
                  value={newModel.provider_id || ''}
                  onChange={(value) => setNewModel({ ...newModel, provider_id: value })}
                  options={providers.map(p => ({
                    label: p.name || p.provider_id,
                    value: p.provider_id
                  }))}
                  placeholder="选择提供商"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">{t('admin.modelId')}</label>
                <input
                  type="text"
                  value={newModel.model_id || ''}
                  onChange={(e) => setNewModel({ ...newModel, model_id: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. gpt-4-turbo"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">{t('admin.modelType')}</label>
                <Select
                  value={newModel.model_type || 'text'}
                  onChange={(value) => setNewModel({ ...newModel, model_type: value as any })}
                  options={[
                    { label: 'Text', value: 'text' },
                    { label: 'Embedding', value: 'embedding' },
                    { label: 'Rerank', value: 'rerank' }
                  ]}
                  placeholder="选择模型类型"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">{t('admin.capabilities')}</label>
                <div className="flex flex-wrap gap-4">
                  {['base', 'chat', 'vision', 'function_calling', 'reasoning'].map(cap => (
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
                      <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{cap.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setIsModelModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
                {t('admin.cancel')}
              </button>
              <button
                onClick={handleSaveModel}
                disabled={!newModel.model_id}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 dark:shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('admin.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
