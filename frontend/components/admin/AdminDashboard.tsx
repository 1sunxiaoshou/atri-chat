import React, { useState, useEffect } from 'react';
import { Server, Cpu, Users, Box } from 'lucide-react';
import { Provider, Model, Character, AdminTab, VRMModel } from '../../types';
import { api } from '../../services/api/index';
import { useLanguage } from '../../contexts/LanguageContext';
import { AdminProviders } from './AdminProviders';
import { AdminModels } from './AdminModels';
import { AdminCharacters } from './AdminCharacters';
import { AdminVRM } from './AdminVRM';

interface AdminDashboardProps {
  onBack?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack: _onBack }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<AdminTab>('providers');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [providerTemplates, setProviderTemplates] = useState<any[]>([]);
  const [vrmModels, setVrmModels] = useState<VRMModel[]>([]);

  useEffect(() => {
    fetchData();
    fetchTemplates();
  }, []);

  const fetchData = async () => {
    const providersResponse = await api.getProviders();
    const modelsResponse = await api.getModels();
    const charactersResponse = await api.getCharacters();
    const vrmModelsResponse = await api.getVRMModels();
    setProviders(providersResponse.data);
    setModels(modelsResponse.data);
    setCharacters(charactersResponse.data);
    if (vrmModelsResponse.code === 200) {
      setVrmModels(vrmModelsResponse.data || []);
    }
  };

  const fetchVRMModels = async () => {
    const vrmModelsResponse = await api.getVRMModels();
    if (vrmModelsResponse.code === 200) {
      setVrmModels(vrmModelsResponse.data || []);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.getProviderTemplates();
      if (res.code === 200) {
        setProviderTemplates(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch provider templates:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900/50 relative">
      {/* Tabs */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-8 pt-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('admin.title')}</h2>
        <div className="flex gap-8">
          {[
            { id: 'providers', label: t('admin.providers'), icon: Server },
            { id: 'models', label: t('admin.models'), icon: Cpu },
            { id: 'characters', label: t('admin.characters'), icon: Users },
            { id: 'vrm', label: 'VRM Models', icon: Box },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`pb-4 px-2 flex items-center gap-2 font-medium transition-all relative ${activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              <tab.icon size={18} />
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto h-full">
          {activeTab === 'providers' && (
            <AdminProviders
              providers={providers}
              providerTemplates={providerTemplates}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'models' && (
            <AdminModels
              providers={providers}
              models={models}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'characters' && (
            <AdminCharacters
              characters={characters}
              models={models}
              vrmModels={vrmModels}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'vrm' && <AdminVRM onModelsChange={fetchVRMModels} />}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;