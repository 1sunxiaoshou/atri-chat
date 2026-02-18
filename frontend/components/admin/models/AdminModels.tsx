import React, { useState } from 'react';
import { Plus, Search, Trash, Edit2, RefreshCw, X, Sparkles, PackageSearch } from 'lucide-react';
import { Provider, Model } from '../../../types';
import { buildLogoUrl } from '../../../utils/url';
import { useLanguage } from '../../../contexts/LanguageContext';
import { providersApi, modelsApi } from '../../../services/api';
import { Select, ConfirmDialog, Button, Input, Card, CardContent, Modal, Toast, ToastMessage } from '../../ui';
import { cn } from '../../../utils/cn';

interface AdminModelsProps {
  providers: Provider[];
  models: Model[];
  providerTemplates: any[];
  onRefresh: () => Promise<void>;
}

export const AdminModels: React.FC<AdminModelsProps> = ({
  providers,
  models,
  providerTemplates,
  onRefresh,
}) => {
  const { t } = useLanguage();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Partial<Provider> | null>(null);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<Partial<Model> | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
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

  const categories = [
    { id: 'all', label: t('admin.allCategories') || '全部' },
    { id: 'chat', label: t('admin.chat') || '聊天' },
    { id: 'embedding', label: t('admin.embedding') || '嵌入' },
    { id: 'rerank', label: t('admin.rerank') || '重排' },
  ];

  const filteredModels = models.filter(m => {
    if (selectedProvider && m.provider_id !== selectedProvider) return false;
    if (searchQuery && !m.model_id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (activeCategory === 'all') return true;
    if (['chat', 'embedding', 'rerank'].includes(activeCategory)) {
      return m.model_type === activeCategory;
    }
    return m.capabilities.includes(activeCategory);
  });

  const getProviderModelCount = (providerId: string) => {
    return models.filter(m => m.provider_id === providerId).length;
  };

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
        template_type: defaultTemplate?.template_type || 'openai',
        description: '',
        config_json: defaultConfigJson
      });
    }
    setIsProviderModalOpen(true);
  };

  const handleSaveProvider = async () => {
    if (!editingProvider || !editingProvider.provider_id) return;
    const existing = providers.find(p => p.provider_id === editingProvider.provider_id);
    if (existing) {
      await providersApi.updateProvider(editingProvider.provider_id, {
        config_json: editingProvider.config_json
      });
    } else {
      await providersApi.createProvider(editingProvider as Provider);
    }
    setIsProviderModalOpen(false);
    await onRefresh();
  };

  const handleDeleteProvider = async (providerId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t('admin.delete'),
      description: t('admin.confirmDeleteProvider'),
      type: 'danger',
      onConfirm: async () => {
        await providersApi.deleteProvider(providerId);
        if (selectedProvider === providerId) setSelectedProvider(null);
        await onRefresh();
      }
    });
  };

  const handleOpenModelModal = (model?: Model) => {
    if (model) {
      setEditingModel({ ...model });
    } else {
      setEditingModel({
        provider_id: selectedProvider || '',
        model_id: '',
        model_type: 'chat',
        capabilities: [],
        enabled: true
      });
    }
    setIsModelModalOpen(true);
  };

  const handleSaveModel = async () => {
    if (!editingModel || !editingModel.model_id || !editingModel.provider_id) return;
    const existing = models.find(m => m.provider_id === editingModel.provider_id && m.model_id === editingModel.model_id);
    if (existing && existing.model_id === editingModel.model_id) {
      await modelsApi.updateModel(editingModel.provider_id, editingModel.model_id, editingModel as Model);
    } else {
      await modelsApi.createModel(editingModel as Model);
    }
    setIsModelModalOpen(false);
    await onRefresh();
  };

  const handleDeleteModel = async (providerId: string, modelId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t('admin.delete'),
      description: t('admin.confirmDeleteModel'),
      type: 'danger',
      onConfirm: async () => {
        await modelsApi.deleteModel(providerId, modelId);
        await onRefresh();
      }
    });
  };

  const handleToggleModel = async (model: Model) => {
    await modelsApi.toggleModel(model.model_id, !model.enabled, model.provider_id);
    await onRefresh();
  };

  const handleSyncModels = async () => {
    if (!selectedProvider || isSyncing) return;
    setIsSyncing(true);
    try {
      const response = await modelsApi.syncProviderModels(selectedProvider, false);
      if (response.code !== 200) {
        setToast({ success: false, message: response.message || '同步失败' });
        setTimeout(() => setToast(null), 3000);
        return;
      }
      const { added, updated, failed, total } = response.data;
      const isSuccess = total > 0 && failed === 0;
      let resultMessage = total === 0 ? '未获取到任何模型' : `新增 ${added} 个` + (updated > 0 ? `，更新 ${updated} 个` : '');
      if (failed > 0) resultMessage += `，失败 ${failed} 个`;
      setToast({ success: isSuccess, message: resultMessage });
      setTimeout(() => setToast(null), 3000);
      if (isSuccess || added > 0) await onRefresh();
    } catch (error: any) {
      setToast({ success: false, message: error.message || '未知错误' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleCapability = (capability: string) => {
    if (!editingModel) return;
    const capabilities = editingModel.capabilities || [];
    const index = capabilities.indexOf(capability);
    setEditingModel({
      ...editingModel,
      capabilities: index > -1 ? capabilities.filter(c => c !== capability) : [...capabilities, capability]
    });
  };

  return (
    <div className="flex h-full bg-background rounded-xl overflow-hidden border border-border shadow-sm animate-in fade-in duration-500">
      {/* Sidebar: Providers */}
      <aside className="w-72 flex flex-col border-r border-border bg-muted/20">
        <div className="h-16 px-4 border-b border-border flex justify-between items-center bg-background">
          <h3 className="text-sm font-bold text-foreground">模型供应商</h3>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {providers.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {providers.map((provider) => (
            <div
              key={provider.provider_id}
              onClick={() => setSelectedProvider(provider.provider_id)}
              className={cn(
                "group relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 border",
                selectedProvider === provider.provider_id
                  ? 'bg-primary/10 border-primary/20 text-primary'
                  : 'bg-transparent border-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground'
              )}
            >
              {provider.logo && (
                <div className="flex-shrink-0 w-8 h-8 rounded-md overflow-hidden bg-white border border-border flex items-center justify-center">
                  <img src={buildLogoUrl(provider.logo)} alt="" className="w-6 h-6 object-contain" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate text-sm">{provider.provider_id}</h4>
                <p className="text-[10px] opacity-70 mt-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {getProviderModelCount(provider.provider_id)} models
                </p>
              </div>
              <div className="absolute right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleOpenProviderModal(provider); }}>
                  <Edit2 size={12} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteProvider(provider.provider_id); }}>
                  <Trash size={12} />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-border bg-background">
          <Button onClick={() => handleOpenProviderModal()} className="w-full" size="sm">
            <Plus size={16} className="mr-2" />
            {t('admin.addProvider')}
          </Button>
        </div>
      </aside>

      {/* Main: Models */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
        {selectedProvider ? (
          <>
            <div className="h-16 px-6 flex items-center gap-4 border-b border-border sticky top-0 z-20 bg-background/80 backdrop-blur-sm">
              <div className="relative w-64 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search models..."
                  className="w-full pl-9 pr-4 py-1.5 bg-muted/50 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-all"
                />
              </div>

              <div className="flex-1 flex gap-1 overflow-x-auto no-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap border",
                      activeCategory === cat.id
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-muted/50 text-muted-foreground border-transparent hover:border-border'
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 border-l border-border pl-4">
                <Button variant="outline" size="icon" onClick={handleSyncModels} disabled={isSyncing} title="Sync Models">
                  <RefreshCw size={16} className={cn(isSyncing && "animate-spin")} />
                </Button>
                <Button size="icon" onClick={() => handleOpenModelModal()} title="Add Model">
                  <Plus size={16} />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/30 sticky top-0 z-10 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 font-medium text-muted-foreground">模型 ID</th>
                    <th className="px-6 py-3 font-medium text-muted-foreground">能力</th>
                    <th className="px-6 py-3 font-medium text-muted-foreground w-20">状态</th>
                    <th className="px-6 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredModels.length > 0 ? (
                    filteredModels.map((model) => (
                      <tr key={`${model.provider_id}-${model.model_id}`} className="group hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4 font-medium">{model.model_id}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1 flex-wrap">
                            {model.capabilities.map((cap) => (
                              <span key={cap} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold border border-primary/20">
                                {cap.replace('_', ' ')}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleToggleModel(model)}
                            className={cn(
                              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                              model.enabled ? 'bg-emerald-500' : 'bg-muted'
                            )}
                          >
                            <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform", model.enabled ? 'translate-x-5' : 'translate-x-0.5')} />
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenModelModal(model)}>
                              <Edit2 size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteModel(model.provider_id, model.model_id)}>
                              <Trash size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center">
                          <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                            <PackageSearch size={32} className="text-muted-foreground" />
                          </div>
                          <p className="font-medium text-foreground mb-1">{t('admin.noModelsFound')}</p>
                          <p className="text-xs text-muted-foreground">尝试调整搜索条件或分类筛选</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
            <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 overflow-hidden ring-4 ring-background shadow-2xl">
              <Sparkles size={40} className="text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">{t('admin.selectProvider')}</h3>
            <p className="text-sm text-muted-foreground max-w-md">{t('admin.selectProviderDesc')}</p>
          </div>
        )}
      </main>

      {/* Modals */}
      {isProviderModalOpen && editingProvider && (
        <Modal isOpen={isProviderModalOpen} onClose={() => setIsProviderModalOpen(false)} title={editingProvider.provider_id ? t('admin.editProvider') : t('admin.addProvider')}>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('admin.providerId')} value={editingProvider.provider_id} onChange={(e) => setEditingProvider({ ...editingProvider, provider_id: e.target.value })} disabled={!!editingProvider.provider_id && providers.some(p => p.provider_id === editingProvider.provider_id)} placeholder="e.g. openai" />
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('admin.providerTemplate')}</label>
                <Select
                  value={editingProvider.template_type || providerTemplates[0]?.template_type || 'openai'}
                  onChange={(val) => {
                    const template = providerTemplates.find(t => t.template_type === val);
                    const config: any = {};
                    template?.config_fields?.forEach((f: any) => { config[f.field_name] = f.default_value || ''; });
                    setEditingProvider({ ...editingProvider, template_type: val as any, config_json: config });
                  }}
                  options={providerTemplates.map(t => ({ label: t.name, value: t.template_type }))}
                />
              </div>
            </div>
            <div className="space-y-4 pt-4 border-t border-border">
              <h4 className="text-sm font-semibold">Configuration</h4>
              <Input label={t('admin.apiKey')} type="password" value={editingProvider.config_json?.api_key || ''} onChange={(e) => setEditingProvider({ ...editingProvider, config_json: { ...editingProvider.config_json, api_key: e.target.value } })} showPasswordToggle />
              <Input label={t('admin.baseUrl')} value={editingProvider.config_json?.base_url || ''} onChange={(e) => setEditingProvider({ ...editingProvider, config_json: { ...editingProvider.config_json, base_url: e.target.value } })} placeholder="https://api..." />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsProviderModalOpen(false)}>{t('admin.cancel')}</Button>
              <Button onClick={handleSaveProvider} disabled={!editingProvider.provider_id}>{t('admin.save')}</Button>
            </div>
          </div>
        </Modal>
      )}

      {isModelModalOpen && editingModel && (
        <Modal isOpen={isModelModalOpen} onClose={() => setIsModelModalOpen(false)} title={editingModel.model_id ? t('admin.editModelTitle') : t('admin.addModelTitle')}>
          <div className="p-6 space-y-6">
            <Input label={t('admin.modelIdLabel')} value={editingModel.model_id} onChange={(e) => setEditingModel({ ...editingModel, model_id: e.target.value })} />
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('admin.modelTypeLabel')}</label>
              <Select
                value={editingModel.model_type || 'chat'}
                onChange={(val) => setEditingModel({ ...editingModel, model_type: val as any })}
                options={[{ label: '聊天模型', value: 'chat' }, { label: '嵌入模型', value: 'embedding' }, { label: '重排模型', value: 'rerank' }]}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('admin.capabilitiesLabel')}</label>
              <div className="flex flex-wrap gap-2">
                {['vision', 'document', 'video', 'audio', 'reasoning', 'tool_use', 'web_search'].map((cap) => (
                  <button
                    key={cap}
                    onClick={() => toggleCapability(cap)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs border transition-all",
                      (editingModel.capabilities || []).includes(cap) ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                    )}
                  >
                    {cap.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsModelModalOpen(false)}>{t('admin.cancel')}</Button>
              <Button onClick={handleSaveModel} disabled={!editingModel.model_id}>{t('admin.save')}</Button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} onConfirm={confirmDialog.onConfirm} title={confirmDialog.title} description={confirmDialog.description} type={confirmDialog.type} confirmText={t('admin.delete')} cancelText={t('admin.cancel')} />
      <Toast message={toast} title={{ success: '同步成功', error: '同步失败' }} />
    </div>
  );
};
