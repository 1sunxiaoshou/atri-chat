import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { Provider, Model } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import { providersApi, modelsApi } from '../../../services/api';
import { ConfirmDialog, Toast, ToastMessage } from '../../ui';
import { ProviderList } from './ProviderList';
import { ModelToolbar } from './ModelToolbar';
import { ModelTable } from './ModelTable';
import { ProviderModal } from './ProviderModal';
import { ModelModal } from './ModelModal';

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

  // 建议 A：默认选中第一个供应商
  useEffect(() => {
    if (providers.length > 0 && !selectedProvider && providers[0]) {
      setSelectedProvider(providers[0].provider_id);
    }
  }, [providers, selectedProvider]);
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
  }).sort((a, b) => {
    // 优先显示已启用的模型
    if (a.enabled === b.enabled) return 0;
    return a.enabled ? -1 : 1;
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

  return (
    <div className="flex h-full bg-background overflow-hidden animate-in fade-in duration-500">
      {/* Sidebar: Providers - 占20%宽度 */}
      <div className="w-[25%] min-w-[240px] max-w-[400px]">
        <ProviderList
          providers={providers}
          selectedProvider={selectedProvider}
          onSelectProvider={setSelectedProvider}
          onEditProvider={handleOpenProviderModal}
          onDeleteProvider={handleDeleteProvider}
          onAddProvider={() => handleOpenProviderModal()}
          getModelCount={getProviderModelCount}
        />
      </div>

      {/* Main: Models */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
        {selectedProvider ? (
          <>
            <ModelToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              onSync={handleSyncModels}
              onAddModel={() => handleOpenModelModal()}
              isSyncing={isSyncing}
            />

            <ModelTable
              models={filteredModels}
              onEditModel={handleOpenModelModal}
              onDeleteModel={handleDeleteModel}
              onToggleModel={handleToggleModel}
            />
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
      <ProviderModal
        isOpen={isProviderModalOpen}
        onClose={() => setIsProviderModalOpen(false)}
        provider={editingProvider}
        providerTemplates={providerTemplates}
        existingProviders={providers}
        onSave={handleSaveProvider}
        onChange={setEditingProvider}
      />

      <ModelModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        model={editingModel}
        onSave={handleSaveModel}
        onChange={setEditingModel}
      />

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

      <Toast
        message={toast}
        title={{ success: '同步成功', error: '同步失败' }}
      />
    </div>
  );
};
