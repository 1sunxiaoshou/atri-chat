import React, { useState } from 'react';
import { Server, Plus, Trash, CheckCircle, X } from 'lucide-react';
import { Provider } from '../../types';
import { api } from '../../services/api/index';
import { useLanguage } from '../../contexts/LanguageContext';
import { Select } from '../ui';

interface AdminProvidersProps {
  providers: Provider[];
  providerTemplates: any[];
  onRefresh: () => Promise<void>;
}

export const AdminProviders: React.FC<AdminProvidersProps> = ({
  providers,
  providerTemplates,
  onRefresh
}) => {
  const { t } = useLanguage();
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Partial<Provider> | null>(null);

  const handleOpenProviderModal = (provider?: Provider) => {
    if (provider) {
      setEditingProvider({ ...provider });
    } else {
      const defaultTemplate = providerTemplates[0];
      const defaultConfigJson: any = {};

      if (defaultTemplate) {
        defaultTemplate.config_fields?.forEach((field: any) => {
          defaultConfigJson[field.field_name] = field.default_value || '';
        });
      }

      setEditingProvider({
        provider_id: '',
        name: '',
        template_type: defaultTemplate?.template_type || 'openai',
        description: '',
        config_json: defaultConfigJson
      });
    }
    setIsProviderModalOpen(true);
  };

  const handleSaveProvider = async () => {
    if (!editingProvider || !editingProvider.provider_id || !editingProvider.name) {return;}

    const existing = providers.find(p => p.provider_id === editingProvider.provider_id);

    if (existing) {
      await api.updateProvider(editingProvider.provider_id, {
        name: editingProvider.name,
        config_json: editingProvider.config_json
      });
    } else {
      await api.createProvider(editingProvider as Provider);
    }

    setIsProviderModalOpen(false);
    await onRefresh();
  };

  const handleDeleteProvider = async (id: string) => {
    if (window.confirm(t('admin.confirmDeleteProvider'))) {
      await api.deleteProvider(id);
      await onRefresh();
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{t('admin.providers')}</h3>
        <button
          onClick={() => handleOpenProviderModal()}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} /> {t('admin.addProvider')}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {providers.map((p) => (
          <div key={p.provider_id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 text-blue-500 dark:text-blue-400">
              <CheckCircle size={18} />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center border border-gray-100 dark:border-gray-600">
                {p.logo ? (
                  <img src={p.logo.startsWith('http') ? p.logo : 'http://localhost:8000' + p.logo} alt={p.name} className="w-full h-full object-contain rounded-lg" />
                ) : (
                  <Server size={20} className="text-gray-600 dark:text-gray-400" />
                )}
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">{p.name}</h4>
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{p.template_type}</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 min-h-[40px]">{p.description || "No description provided."}</p>
            <div className="space-y-3">
              {Object.keys(p.config_json).slice(0, 2).map(key => (
                <div key={key} className="flex justify-between items-center text-sm border-b border-gray-50 dark:border-gray-700 pb-2">
                  <span className="text-gray-500 dark:text-gray-400 capitalize">{key.replace('_', ' ')}</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                    {key.includes('key') ? '••••••••' : p.config_json[key]}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => handleOpenProviderModal(p)}
                className="flex-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteProvider(p.provider_id)}
                className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-800"
              >
                <Trash size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Provider Modal */}
      {isProviderModalOpen && editingProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn scale-95 opacity-0 fill-mode-forwards" style={{ animation: 'fadeInScale 0.2s forwards' }}>
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-lg">
                {editingProvider.provider_id ? t('admin.editProvider') : t('admin.addProvider')}
              </h3>
              <button onClick={() => setIsProviderModalOpen(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('admin.providerId')}</label>
                  <input
                    type="text"
                    value={editingProvider.provider_id}
                    onChange={(e) => setEditingProvider({ ...editingProvider, provider_id: e.target.value })}
                    disabled={providers.some(p => p.provider_id === editingProvider.provider_id && editingProvider !== p)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. deepseek"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">{t('admin.providerTemplate')}</label>
                  <Select
                    value={editingProvider.template_type || providerTemplates[0]?.template_type || 'openai'}
                    onChange={(value) => {
                      const selectedTemplate = providerTemplates.find(t => t.template_type === value);
                      const newConfigJson: any = {};

                      if (selectedTemplate) {
                        selectedTemplate.config_fields?.forEach((field: any) => {
                          newConfigJson[field.field_name] = field.default_value || '';
                        });
                      }

                      setEditingProvider({
                        ...editingProvider,
                        template_type: value as any,
                        config_json: newConfigJson
                      });
                    }}
                    options={providerTemplates.map(template => ({
                      label: template.name,
                      value: template.template_type
                    }))}
                    placeholder="选择模板类型"
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">{t('admin.providerName')}</label>
                <input
                  type="text"
                  value={editingProvider.name || ''}
                  onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Display Name"
                />
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Configuration</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('admin.apiKey')}</label>
                    <input
                      type="password"
                      value={editingProvider.config_json?.api_key || ''}
                      onChange={(e) => setEditingProvider({
                        ...editingProvider,
                        config_json: { ...editingProvider.config_json, api_key: e.target.value }
                      })}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                      placeholder="sk-..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('admin.baseUrl')}</label>
                    <input
                      type="text"
                      value={editingProvider.config_json?.base_url || ''}
                      onChange={(e) => setEditingProvider({
                        ...editingProvider,
                        config_json: { ...editingProvider.config_json, base_url: e.target.value }
                      })}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                      placeholder="https://api..."
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setIsProviderModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
                {t('admin.cancel')}
              </button>
              <button
                onClick={handleSaveProvider}
                disabled={!editingProvider.provider_id}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 dark:shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('admin.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
