import React, { useState } from 'react';
import { Plus, Search, Trash, Edit2, Settings, RefreshCw, X } from 'lucide-react';
import { Provider, Model } from '../../types';
import { buildLogoUrl } from '../../utils/url';
import { useLanguage } from '../../contexts/LanguageContext';
import { providersApi, modelsApi } from '../../services/api';
import { Select, ConfirmDialog } from '../ui';
import Toast, { ToastMessage } from '../Toast';

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
    onConfirm: () => {}
  });

  // 分类定义 - 只显示常用筛选
  const categories = [
    { id: 'all', label: t('admin.allCategories') || '全部' },
    { id: 'chat', label: t('admin.chat') || '聊天' },
    { id: 'embedding', label: t('admin.embedding') || '嵌入' },
    { id: 'rerank', label: t('admin.rerank') || '重排' },
  ];

  // 能力标签统一颜色
  const capabilityColor = 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20';

  // 筛选模型
  const filteredModels = models.filter(m => {
    if (selectedProvider && m.provider_id !== selectedProvider) return false;
    if (searchQuery && !m.model_id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (activeCategory === 'all') return true;
    // 按模型类型筛选
    if (['chat', 'embedding', 'rerank'].includes(activeCategory)) {
      return m.model_type === activeCategory;
    }
    // 按能力筛选
    return m.capabilities.includes(activeCategory);
  });

  // 获取供应商的模型数量
  const getProviderModelCount = (providerId: string) => {
    return models.filter(m => m.provider_id === providerId).length;
  };

  // 打开供应商模态框
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

  // 保存供应商
  const handleSaveProvider = async () => {
    if (!editingProvider || !editingProvider.provider_id) {return;}

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

  // 删除供应商
  const handleDeleteProvider = async (providerId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t('admin.delete'),
      description: t('admin.confirmDeleteProvider'),
      type: 'danger',
      onConfirm: async () => {
        await providersApi.deleteProvider(providerId);
        if (selectedProvider === providerId) {
          setSelectedProvider(null);
        }
        await onRefresh();
      }
    });
  };

  // 打开模型模态框
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

  // 保存模型（新增或编辑）
  const handleSaveModel = async () => {
    if (!editingModel || !editingModel.model_id || !editingModel.provider_id) {
      return;
    }

    const existing = models.find(m => m.provider_id === editingModel.provider_id && m.model_id === editingModel.model_id);

    if (existing && existing.model_id === editingModel.model_id) {
      // 编辑模式：更新模型
      await modelsApi.updateModel(editingModel.provider_id, editingModel.model_id, editingModel as Model);
    } else {
      // 新增模式：创建模型
      await modelsApi.createModel(editingModel as Model);
    }
    
    setIsModelModalOpen(false);
    await onRefresh();
  };

  // 删除模型
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

  // 切换模型启用状态
  const handleToggleModel = async (model: Model) => {
    await modelsApi.toggleModel(model.model_id, !model.enabled, model.provider_id);
    await onRefresh();
  };

  // 同步供应商模型
  const handleSyncModels = async () => {
    if (!selectedProvider) return;
    
    // 防止重复点击
    if (isSyncing) {
      setToast({
        success: false,
        message: '正在同步中，请稍候...'
      });
      setTimeout(() => setToast(null), 2000);
      return;
    }

    setIsSyncing(true);
    
    try {
      const response = await modelsApi.syncProviderModels(selectedProvider, false);
      
      // 检查响应状态
      if (response.code !== 200) {
        // 直接使用 response.message（已经包含原始错误信息）
        setToast({
          success: false,
          message: response.message || '同步失败'
        });
        setTimeout(() => setToast(null), 3000);
        return;
      }
      
      const { added, updated, skipped, failed, total } = response.data;
      
      // 判断是否真正成功
      const isSuccess = total > 0 && failed === 0;
      
      // 构建结果消息
      let resultMessage = '';
      if (total === 0) {
        resultMessage = '未获取到任何模型，请检查 API 配置';
      } else if (failed === total) {
        resultMessage = `同步失败：所有 ${total} 个模型都失败了`;
      } else {
        resultMessage = `新增 ${added} 个`;
        if (updated > 0) resultMessage += `，更新 ${updated} 个`;
        if (skipped > 0) resultMessage += `，跳过 ${skipped} 个`;
        if (failed > 0) resultMessage += `，失败 ${failed} 个`;
      }
      
      setToast({
        success: isSuccess,
        message: resultMessage
      });
      
      // 3秒后自动关闭通知
      setTimeout(() => setToast(null), 3000);
      
      // 只有成功时才刷新列表
      if (isSuccess || added > 0) {
        await onRefresh();
      }
    } catch (error: any) {
      // catch 块不应该被触发，因为 API 调用已经处理了所有错误
      // 但为了安全起见，保留兜底处理
      setToast({
        success: false,
        message: error.message || '同步模型时发生未知错误'
      });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  // 切换能力标签
  const toggleCapability = (capability: string) => {
    if (!editingModel) return;
    
    const capabilities = editingModel.capabilities || [];
    const index = capabilities.indexOf(capability);
    
    if (index > -1) {
      setEditingModel({
        ...editingModel,
        capabilities: capabilities.filter(c => c !== capability)
      });
    } else {
      setEditingModel({
        ...editingModel,
        capabilities: [...capabilities, capability]
      });
    }
  };

  return (
    <div className="flex h-full bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm animate-fadeIn">
      {/* 左侧 - 供应商列表 Sidebar */}
      <div className="w-80 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black/20">
        <div className="h-[72px] px-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-900 sticky top-0 z-10 backdrop-blur-sm">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
            模型供应商
          </h3>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            {providers.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {providers.map((provider) => (
            <div
              key={provider.provider_id}
              onClick={() => setSelectedProvider(provider.provider_id)}
              className={`
                group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border
                ${selectedProvider === provider.provider_id
                  ? 'bg-white dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 shadow-sm ring-1 ring-blue-100 dark:ring-blue-500/20'
                  : 'bg-transparent border-transparent hover:bg-white dark:hover:bg-gray-800/50 hover:border-gray-200 dark:hover:border-gray-700/50'
                }
              `}
            >
              {/* Logo */}
              {provider.logo && (
                <div className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                  <img 
                    src={buildLogoUrl(provider.logo)} 
                    alt={provider.provider_id}
                    className="w-6 h-6 object-contain"
                  />
                </div>
              )}
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <h4 className={`font-medium truncate ${selectedProvider === provider.provider_id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}`}>
                  {provider.provider_id}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  {getProviderModelCount(provider.provider_id)} models
                </p>
              </div>

              {/* Hover Actions */}
              <div className={`
                absolute right-2 flex gap-1 rounded-lg p-0.5
                opacity-0 group-hover:opacity-100 transition-opacity duration-200 scale-95 group-hover:scale-100
                ${selectedProvider === provider.provider_id ? 'opacity-100' : ''}
              `}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenProviderModal(provider);
                  }}
                  className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                  title="Edit"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProvider(provider.provider_id);
                  }}
                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                  title="Delete"
                >
                  <Trash size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Provider Button */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            onClick={() => handleOpenProviderModal()}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg flex items-center justify-center gap-2 font-medium transition-colors shadow-sm text-sm"
          >
            <Plus size={16} />
            {t('admin.addProvider')}
          </button>
        </div>
      </div>

      {/* 右侧 - 模型列表 Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-900 relative">
        {selectedProvider ? (
          <>
            {/* Toolbar & Actions */}
            <div className="h-[72px] px-6 flex items-center gap-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
              {/* Search */}
              <div className="relative w-64 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                />
              </div>

              {/* Categories */}
              <div className="flex-1 flex gap-1.5 overflow-x-auto no-scrollbar">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`
                      px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border
                      ${activeCategory === category.id
                        ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100 shadow-sm'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    {category.label}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-800 pl-4">
                <button
                  onClick={handleSyncModels}
                  disabled={isSyncing}
                  className={`p-2 rounded-lg transition-colors ${
                    isSyncing 
                      ? 'text-gray-400 cursor-not-allowed' 
                      : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  }`}
                  title={isSyncing ? '同步中...' : '同步模型'}
                >
                  <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={() => handleOpenModelModal()}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title="Add Model"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-sm border-separate border-spacing-0">
                <thead className="bg-gray-50/50 dark:bg-gray-800 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="px-4 py-3.5 text-xs font-medium text-gray-500 dark:text-gray-400 text-left border-b border-gray-100 dark:border-gray-800" style={{ width: '40%' }}>
                      {t('admin.modelId') || '模型 ID'}
                    </th>
                    <th className="px-4 py-3.5 text-xs font-medium text-gray-500 dark:text-gray-400 text-left border-b border-gray-100 dark:border-gray-800" style={{ width: '48%' }}>
                      {t('admin.capabilities') || '能力'}
                    </th>
                    <th className="px-3 py-3.5 text-xs font-medium text-gray-500 dark:text-gray-400 text-left border-b border-gray-100 dark:border-gray-800" style={{ width: '6%' }}>
                      {t('admin.status') || '状态'}
                    </th>
                    <th className="px-3 py-3.5 border-b border-gray-100 dark:border-gray-800" style={{ width: '6%' }}></th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900">
                  {filteredModels.length > 0 ? (
                    filteredModels.map((model) => (
                      <tr
                        key={`${model.provider_id}-${model.model_id}`}
                        className="group hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors border-b border-gray-100 dark:border-gray-800/50 last:border-0"
                      >
                        <td className="px-4 py-3.5 border-b border-gray-100 dark:border-gray-800/50 align-middle" style={{ width: '40%' }}>
                          <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                            {model.model_id}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 border-b border-gray-100 dark:border-gray-800/50 align-middle" style={{ width: '48%' }}>
                          <div className="flex gap-1.5 flex-wrap">
                            {model.capabilities.map((cap) => (
                              <span
                                key={cap}
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${capabilityColor}`}
                              >
                                {cap.charAt(0).toUpperCase() + cap.slice(1).replace('_', ' ')}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-3.5 border-b border-gray-100 dark:border-gray-800/50 align-middle" style={{ width: '6%' }}>
                          <button
                            onClick={() => handleToggleModel(model)}
                            className={`
                              relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                              ${model.enabled ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}
                            `}
                          >
                            <span className="sr-only">Use setting</span>
                            <span
                              className={`
                                pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                                ${model.enabled ? 'translate-x-4' : 'translate-x-0'}
                              `}
                            />
                          </button>
                        </td>
                        <td className="px-3 py-3.5 border-b border-gray-100 dark:border-gray-800 align-middle" style={{ width: '6%' }}>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenModelModal(model)}
                              className="text-gray-400 hover:text-blue-500 p-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all opacity-0 group-hover:opacity-100"
                              title="Edit Model"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteModel(model.provider_id, model.model_id)}
                              className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                              title="Delete Model"
                            >
                              <Trash size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                          <div className="w-24 h-24 bg-gray-50 dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center mb-6 rotate-3">
                            <Search size={48} className="text-gray-400/80 dark:text-gray-500/80" />
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                            {t('admin.noModelsFound')}
                          </h3>
                          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs leading-relaxed">
                            {t('admin.noModelsFoundDesc')}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-gray-50/50 dark:bg-gray-900/50">
            <div className="w-24 h-24 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center mb-6 rotate-3">
              <Settings size={48} className="text-blue-500/80 dark:text-blue-400/80" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {t('admin.selectProvider')}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs leading-relaxed">
              {t('admin.selectProviderDesc')}
            </p>
          </div>
        )}
      </div>

      {/* Provider Modal */}
      {isProviderModalOpen && editingProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-lg">
                {editingProvider.provider_id && providers.find(p => p.provider_id === editingProvider.provider_id) 
                  ? t('admin.editProvider') 
                  : t('admin.addProvider')}
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
                    disabled={providers.some(p => p.provider_id === editingProvider.provider_id)}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder={t('admin.providerIdPlaceholder')}
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('admin.providerIdHelp')}</p>
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
                    placeholder={t('admin.selectTemplate')}
                    className="w-full"
                  />
                </div>
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

      {/* Model Modal */}
      {isModelModalOpen && editingModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-lg">
                {editingModel && models.find(m => m.provider_id === editingModel.provider_id && m.model_id === editingModel.model_id)
                  ? t('admin.editModelTitle')
                  : t('admin.addModelTitle')}
              </h3>
              <button onClick={() => setIsModelModalOpen(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">{t('admin.modelIdLabel')}</label>
                <input
                  type="text"
                  value={editingModel.model_id}
                  onChange={(e) => setEditingModel({ ...editingModel, model_id: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder={t('admin.modelIdPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">{t('admin.modelTypeLabel')}</label>
                <Select
                  value={editingModel.model_type || 'chat'}
                  onChange={(value) => setEditingModel({ ...editingModel, model_type: value as any })}
                  options={[
                    { label: t('admin.chatModel') || '聊天模型', value: 'chat' },
                    { label: t('admin.embeddingModel') || '嵌入模型', value: 'embedding' },
                    { label: t('admin.rerankModel') || '重排模型', value: 'rerank' }
                  ]}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">{t('admin.capabilitiesLabel')}</label>
                <div className="flex flex-wrap gap-2">
                  {['vision', 'document', 'video', 'audio', 'reasoning', 'tool_use', 'web_search'].map((cap) => (
                    <button
                      key={cap}
                      onClick={() => toggleCapability(cap)}
                      className={`
                        px-3 py-1.5 rounded-full text-xs font-medium transition-all border
                        ${(editingModel.capabilities || []).includes(cap)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                        }
                      `}
                    >
                      {cap.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{t('admin.capabilitiesHelp')}</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="model-enabled"
                  checked={editingModel.enabled}
                  onChange={(e) => setEditingModel({ ...editingModel, enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="model-enabled" className="text-sm text-gray-700 dark:text-gray-300">
                  {t('admin.enableModel')}
                </label>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setIsModelModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
                {t('admin.cancel')}
              </button>
              <button
                onClick={handleSaveModel}
                disabled={!editingModel.model_id || !editingModel.provider_id}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 dark:shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('admin.save')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Confirm Dialog */}
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
      
      {/* Toast Notification */}
      <Toast message={toast} title={{ success: '同步成功', error: '同步失败' }} />
    </div>
  );
};
