import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { Provider, Model } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import { providersApi, modelsApi } from '../../../services/api';
import { useDataStore } from '../../../store/useDataStore';
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
  const [selectedProvider, setSelectedProvider] = useState<number | null>(null);

  // 建议 A：默认选中第一个供应商
  useEffect(() => {
    if (providers.length > 0 && selectedProvider === null && providers[0]) {
      setSelectedProvider(providers[0].id);
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
    { id: 'all', label: t('admin.allCategories') },
    { id: 'chat', label: t('admin.chat') },
    { id: 'embedding', label: t('admin.embedding') },
    { id: 'rerank', label: t('admin.rerank') },
  ];

  const [showEnabledOnly, setShowEnabledOnly] = useState(false);

  const filteredModels = models.filter(m => {
    if (selectedProvider !== null && m.provider_config_id !== selectedProvider) return false;
    if (searchQuery && !m.model_id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (showEnabledOnly && !m.enabled) return false;
    if (activeCategory === 'all') return true;
    if (['chat', 'embedding', 'rerank'].includes(activeCategory)) {
      return m.model_type === activeCategory;
    }
    return m.capabilities.includes(activeCategory);
  });

  const getProviderModelCount = (providerConfigId: number) => {
    return models.filter(m => m.provider_config_id === providerConfigId).length;
  };

  const handleOpenProviderModal = (provider?: Provider) => {
    if (provider) {
      setEditingProvider({ ...provider });
    } else {
      const defaultTemplate = providerTemplates[0];
      const defaultConfigPayload: any = {};
      if (defaultTemplate) {
        defaultTemplate.config_fields?.forEach((field: any) => {
          defaultConfigPayload[field.field_name] = field.default_value || '';
        });
      }
      setEditingProvider({
        name: defaultTemplate?.name || '',
        provider_type: defaultTemplate?.provider_type || 'openai',
        description: '',
        config_payload: defaultConfigPayload
      });
    }
    setIsProviderModalOpen(true);
  };

  const handleSaveProvider = async () => {
    if (!editingProvider || !editingProvider.name) return;

    try {
      if (editingProvider.id) {
        // 更新现有供应商
        await providersApi.updateProvider(editingProvider.id, {
          name: editingProvider.name,
          config_payload: editingProvider.config_payload,
          provider_type: editingProvider.provider_type
        });
        setToast({ success: true, message: t('admin.providerUpdated') });
      } else {
        // 创建新供应商
        await providersApi.createProvider(editingProvider as Provider);
        setToast({ success: true, message: t('admin.providerCreated') });
      }
      setIsProviderModalOpen(false);
      await onRefresh();
    } catch (error: any) {
      // 处理后端返回的错误
      const errorMessage = error.response?.data?.detail || error.message || t('admin.operationFailed');

      // 如果是重复ID错误，显示特定提示
      if (errorMessage.includes('已存在') || errorMessage.includes('already exists')) {
        setToast({
          success: false,
          message: t('admin.providerIdExists')
        });
      } else {
        setToast({
          success: false,
          message: errorMessage
        });
      }
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeleteProvider = async (configId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: t('admin.delete'),
      description: t('admin.confirmDeleteProvider'),
      type: 'danger',
      onConfirm: async () => {
        await providersApi.deleteProvider(configId);
        if (selectedProvider === configId) setSelectedProvider(null);
        await onRefresh();
      }
    });
  };

  const handleOpenModelModal = (model?: Model) => {
    if (model) {
      setEditingModel({ ...model });
    } else {
      setEditingModel({
        provider_config_id: selectedProvider || 0,
        model_id: '',
        model_type: 'chat',
        capabilities: [],
        enabled: true
      });
    }
    setIsModelModalOpen(true);
  };

  const handleSaveModel = async () => {
    if (!editingModel || !editingModel.model_id || !editingModel.provider_config_id) return;
    const existing = models.find(m => m.provider_config_id === editingModel.provider_config_id && m.model_id === editingModel.model_id);
    if (existing && existing.model_id === editingModel.model_id) {
      await modelsApi.updateModel(editingModel.provider_config_id, editingModel.model_id, editingModel as Model);
    } else {
      await modelsApi.createModel(editingModel as Model);
    }
    setIsModelModalOpen(false);
    await onRefresh();
  };

  const handleDeleteModel = async (providerConfigId: number, modelId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t('admin.delete'),
      description: t('admin.confirmDeleteModel'),
      type: 'danger',
      onConfirm: async () => {
        await modelsApi.deleteModel(providerConfigId, modelId);
        await onRefresh();
      }
    });
  };

  const { updateModelStatus } = useDataStore();

  const handleToggleModel = async (model: Model) => {
    const newEnabled = !model.enabled;
    // 乐观更新：立即应用 UI 变化
    updateModelStatus(model.provider_config_id, model.model_id, newEnabled);
    
    try {
      await modelsApi.toggleModel(model.model_id, newEnabled, model.provider_config_id, model);
    } catch (error) {
      // 出错时回滚
      updateModelStatus(model.provider_config_id, model.model_id, !newEnabled);
      setToast({ success: false, message: t('admin.operationFailed') });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleSyncModels = async () => {
    if (!selectedProvider || isSyncing) return;
    setIsSyncing(true);
    try {
      const response = await modelsApi.syncProviderModels(selectedProvider, false);
      if (response.code !== 200) {
        setToast({ success: false, message: response.message || t('admin.syncFailed') });
        setTimeout(() => setToast(null), 3000);
        return;
      }
      const { added, updated, failed, total } = response.data;
      const isSuccess = total > 0 && failed === 0;
      let resultMessage = total === 0
        ? t('admin.noModelsFound')
        : t('admin.syncResult', { added, updated: updated > 0 ? t('admin.updated', { count: updated }) : '' });
      if (failed > 0) resultMessage += t('admin.failed', { count: failed });
      setToast({ success: isSuccess, message: resultMessage });
      setTimeout(() => setToast(null), 3000);
      if (isSuccess || added > 0) await onRefresh();
    } catch (error: any) {
      setToast({ success: false, message: error.message || t('admin.unknownError') });
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
              showEnabledOnly={showEnabledOnly}
              onToggleEnabledFilter={() => setShowEnabledOnly(!showEnabledOnly)}
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
        title={{ success: t('admin.syncSuccess'), error: t('admin.syncFailed') }}
      />
    </div>
  );
};
