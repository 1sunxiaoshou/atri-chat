import React, { useState, useEffect } from 'react';
import { Cpu, Users, Box, Menu } from 'lucide-react';
import { Provider, Model, Character, AdminTab, VRMModel } from '../../types';
import { api } from '../../services/api/index';
import { useLanguage } from '../../contexts/LanguageContext';
import { AdminModels } from './models/AdminModels';
import { AdminCharacters } from './characters/AdminCharacters';
import { AdminVRM } from './vrm/AdminVRM';
import { Button } from '../ui';
import { cn } from '../../utils/cn';

interface AdminDashboardProps {
  onBack?: () => void;
  onOpenMobileSidebar?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack: _onBack, onOpenMobileSidebar }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<AdminTab>('models');
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
    const [providersRes, modelsRes, charsRes, vrmRes] = await Promise.all([
      api.getProviders(),
      api.getModels(),
      api.getCharacters(),
      api.getVRMModels()
    ]);

    setProviders(providersRes.data);
    setModels(modelsRes.data);
    setCharacters(charsRes.data);
    if (vrmRes.code === 200) {
      setVrmModels(vrmRes.data || []);
    }
  };

  const fetchVRMModels = async () => {
    const res = await api.getVRMModels();
    if (res.code === 200) {
      setVrmModels(res.data || []);
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

  const tabs = [
    { id: 'models', label: t('admin.models'), icon: Cpu },
    { id: 'characters', label: t('admin.characters'), icon: Users },
    { id: 'vrm', label: 'VRM Models', icon: Box },
  ];

  return (
    <div className="flex flex-col h-full bg-muted/30 relative">
      {/* Header & Tabs */}
      <header className="bg-background border-b border-border px-4 lg:px-8 pt-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenMobileSidebar}
            className="lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </Button>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{t('admin.title')}</h2>
        </div>

        <nav className="flex gap-4 lg:gap-8 overflow-x-auto scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={cn(
                  "pb-4 px-1 flex items-center gap-2 font-medium transition-all relative whitespace-nowrap flex-shrink-0 text-sm",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto h-full">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 h-full">
            {activeTab === 'models' && (
              <AdminModels
                providers={providers}
                models={models}
                providerTemplates={providerTemplates}
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
      </main>
    </div>
  );
};

export default AdminDashboard;
