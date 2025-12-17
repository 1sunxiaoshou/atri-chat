import React from 'react';
import { api } from '../../services/api/index';
import ProviderSettingsTemplate from './ProviderSettingsTemplate';

const TTSSettings: React.FC = () => {
    const fetchProviders = async () => {
        const res = await api.getTTSProviders();
        if (res.code === 200) {
            return res.data;
        }
        throw new Error('Failed to fetch TTS providers');
    };

    const testConnection = async (providerId: string, config: any) => {
        const res = await api.testTTSConnection(providerId, config);
        if (res.code === 200 && res.data?.success) {
            return { success: true, message: res.data.message || res.message || '连接成功' };
        }
        return { success: false, message: res.data?.message || res.message || '连接失败' };
    };

    const saveConfig = async (providerId: string, config: any) => {
        const res = await api.saveTTSConfig(providerId, config);
        if (res.code === 200) {
            return {
                success: true,
                message: providerId !== 'none' ? '配置已保存' : 'TTS已禁用'
            };
        }
        return { success: false, message: res.message || '保存失败' };
    };

    return (
        <ProviderSettingsTemplate
            fetchProviders={fetchProviders}
            testConnection={testConnection}
            saveConfig={saveConfig}
            emptyStateIcon="🔊"
            emptyStateText="请选择上方的服务商进行配置"
        />
    );
};

export default TTSSettings;
