import { Settings } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useLanguage } from '@/contexts/LanguageContext';

export interface VRMRenderConfig {
    // 环境设置
    environment: 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'studio' | 'city' | 'park' | 'lobby';
    showEnvironmentBackground: boolean;
    backgroundBlurriness: number;
    backgroundIntensity: number;

    // 光照设置
    enableMainLight: boolean;
    mainLightIntensity: number;
    enableAmbientLight: boolean;
    ambientLightIntensity: number;
    enableRimLight: boolean;
    rimLightIntensity: number;

    // 阴影设置
    enableShadows: boolean;
    enableContactShadows: boolean;

    // 后处理特效
    enablePostProcessing: boolean;
    enableBloom: boolean;
    enableDepthOfField: boolean;
    enableVignette: boolean;

    // 强度调节
    bloomIntensity: number;

    // VRM 角色设置
    enableBlink: boolean;
    lookAtMode: 'mouse' | 'camera' | 'none';
}

export const DEFAULT_VRM_RENDER_CONFIG: VRMRenderConfig = {
    environment: 'apartment',
    showEnvironmentBackground: true,
    backgroundBlurriness: 0.0,
    backgroundIntensity: 1.0,
    enableMainLight: true,
    mainLightIntensity: 1.5,
    enableAmbientLight: true,
    ambientLightIntensity: 0.5,
    enableRimLight: true,
    rimLightIntensity: 0.3,
    enableShadows: false,
    enableContactShadows: true,
    enablePostProcessing: true,
    enableBloom: true,
    enableDepthOfField: false,
    enableVignette: true,
    bloomIntensity: 0.3,
    enableBlink: true,
    lookAtMode: 'mouse',
};

interface VRMRenderSettingsProps {
    config: VRMRenderConfig;
    onChange: (config: VRMRenderConfig) => void;
    className?: string;
}

/**
 * VRM 渲染设置面板
 * 提供实时切换渲染特性的 UI
 */
export function VRMRenderSettings({ config, onChange, className }: VRMRenderSettingsProps) {
    const { t } = useLanguage();

    const updateConfig = (updates: Partial<VRMRenderConfig>) => {
        onChange({ ...config, ...updates });
    };

    return (
        <div className={cn(
            "bg-black/80 backdrop-blur-sm rounded-lg p-4 text-xs font-mono space-y-3 border border-white/10 shadow-lg min-w-[240px]",
            className
        )}>
            {/* 标题 */}
            <div className="flex items-center gap-2 text-white font-semibold mb-2 pb-2 border-b border-white/10">
                <Settings className="w-4 h-4" />
                <span>{t('vrm.renderSettings')}</span>
            </div>

            {/* 环境设置 */}
            <div className="space-y-2">
                <div className="text-gray-400 font-semibold">{t('vrm.environment')}</div>

                <select
                    value={config.environment}
                    onChange={(e) => updateConfig({ environment: e.target.value as any })}
                    className="w-full bg-white/10 text-white rounded px-2 py-1 text-xs border border-white/20 focus:outline-none focus:border-blue-400 [&>option]:bg-slate-800 [&>option]:text-white"
                >
                    <option value="apartment">{t('vrm.env.apartment')}</option>
                    <option value="studio">{t('vrm.env.studio')}</option>
                    <option value="sunset">{t('vrm.env.sunset')}</option>
                    <option value="dawn">{t('vrm.env.dawn')}</option>
                    <option value="night">{t('vrm.env.night')}</option>
                    <option value="warehouse">{t('vrm.env.warehouse')}</option>
                    <option value="forest">{t('vrm.env.forest')}</option>
                    <option value="city">{t('vrm.env.city')}</option>
                    <option value="park">{t('vrm.env.park')}</option>
                    <option value="lobby">{t('vrm.env.lobby')}</option>
                </select>

                <ToggleItem
                    label={t('vrm.showBackground')}
                    checked={config.showEnvironmentBackground}
                    onChange={(checked) => updateConfig({ showEnvironmentBackground: checked })}
                />
            </div>

            {/* 分隔线 */}
            <div className="border-t border-white/10" />

            {/* 光照设置 */}
            <div className="space-y-2">
                <div className="text-gray-400 font-semibold">{t('vrm.lighting')}</div>

                <ToggleItem
                    label={t('vrm.mainLight')}
                    checked={config.enableMainLight}
                    onChange={(checked) => updateConfig({ enableMainLight: checked })}
                />

                {config.enableMainLight && (
                    <div className="ml-4">
                        <label className="text-gray-400 text-[10px]">
                            {t('vrm.mainLightIntensity')}: {(config.mainLightIntensity ?? 1.5).toFixed(1)}
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="5"
                            step="0.1"
                            value={config.mainLightIntensity ?? 1.5}
                            onChange={(e) => updateConfig({ mainLightIntensity: parseFloat(e.target.value) })}
                            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                )}

                <ToggleItem
                    label={t('vrm.ambientLight')}
                    checked={config.enableAmbientLight}
                    onChange={(checked) => updateConfig({ enableAmbientLight: checked })}
                />

                {config.enableAmbientLight && (
                    <div className="ml-4">
                        <label className="text-gray-400 text-[10px]">
                            {t('vrm.ambientLightIntensity')}: {(config.ambientLightIntensity ?? 0.5).toFixed(1)}
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={config.ambientLightIntensity ?? 0.5}
                            onChange={(e) => updateConfig({ ambientLightIntensity: parseFloat(e.target.value) })}
                            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                )}

                <ToggleItem
                    label={t('vrm.rimLight')}
                    checked={config.enableRimLight}
                    onChange={(checked) => updateConfig({ enableRimLight: checked })}
                />

                {config.enableRimLight && (
                    <div className="ml-4">
                        <label className="text-gray-400 text-[10px]">
                            {t('vrm.rimLightIntensity')}: {(config.rimLightIntensity ?? 0.3).toFixed(1)}
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={config.rimLightIntensity ?? 0.3}
                            onChange={(e) => updateConfig({ rimLightIntensity: parseFloat(e.target.value) })}
                            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                )}
            </div>

            {/* 分隔线 */}
            <div className="border-t border-white/10" />

            {/* 阴影设置 */}
            <div className="space-y-2">
                <div className="text-gray-400 font-semibold">{t('vrm.shadows')}</div>

                <ToggleItem
                    label={t('vrm.castShadows')}
                    checked={config.enableShadows}
                    onChange={(checked) => updateConfig({ enableShadows: checked })}
                />

                <ToggleItem
                    label={t('vrm.contactShadows')}
                    checked={config.enableContactShadows}
                    onChange={(checked) => updateConfig({ enableContactShadows: checked })}
                />
            </div>

            {/* 分隔线 */}
            <div className="border-t border-white/10" />

            {/* 后处理特效 */}
            <div className="space-y-2">
                <div className="text-gray-400 font-semibold">{t('vrm.postProcessing')}</div>

                <ToggleItem
                    label={t('vrm.enablePostProcessing')}
                    checked={config.enablePostProcessing}
                    onChange={(checked) => updateConfig({ enablePostProcessing: checked })}
                />

                {config.enablePostProcessing && (
                    <div className="ml-4 space-y-2 border-l-2 border-white/10 pl-2">
                        <ToggleItem
                            label={t('vrm.bloom')}
                            checked={config.enableBloom}
                            onChange={(checked) => updateConfig({ enableBloom: checked })}
                        />

                        {config.enableBloom && (
                            <div className="ml-4">
                                <label className="text-gray-400 text-[10px]">
                                    {t('vrm.bloomIntensity')}: {config.bloomIntensity.toFixed(1)}
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={config.bloomIntensity}
                                    onChange={(e) => updateConfig({ bloomIntensity: parseFloat(e.target.value) })}
                                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        )}

                        <ToggleItem
                            label={t('vrm.depthOfField')}
                            checked={config.enableDepthOfField}
                            onChange={(checked) => updateConfig({ enableDepthOfField: checked })}
                        />

                        <ToggleItem
                            label={t('vrm.vignette')}
                            checked={config.enableVignette}
                            onChange={(checked) => updateConfig({ enableVignette: checked })}
                        />
                    </div>
                )}
            </div>

            {/* 分隔线 */}
            <div className="border-t border-white/10" />

            {/* 角色设置 */}
            <div className="space-y-2">
                <div className="text-gray-400 font-semibold">{t('vrm.characterSettings')}</div>

                <ToggleItem
                    label={t('vrm.enableBlink')}
                    checked={config.enableBlink}
                    onChange={(checked) => updateConfig({ enableBlink: checked })}
                />

                <div className="space-y-1">
                    <label className="text-gray-400 text-xs">{t('vrm.lookAtMode')}</label>
                    <select
                        value={config.lookAtMode}
                        onChange={(e) => updateConfig({ lookAtMode: e.target.value as 'mouse' | 'camera' | 'none' })}
                        className="w-full bg-white/10 text-white text-xs rounded px-2 py-1 border border-white/20 focus:border-blue-500 focus:outline-none"
                    >
                        <option value="mouse">{t('vrm.lookAtMouse')}</option>
                        <option value="camera">{t('vrm.lookAtCamera')}</option>
                        <option value="none">{t('vrm.lookAtNone')}</option>
                    </select>
                </div>
            </div>
        </div>
    );
}

/**
 * 切换开关组件
 */
function ToggleItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <label className="flex items-center justify-between cursor-pointer group">
            <span className={cn(
                "text-gray-300 group-hover:text-white transition-colors",
                checked && "text-white"
            )}>
                {label}
            </span>
            <div
                onClick={() => onChange(!checked)}
                className={cn(
                    "relative w-8 h-4 rounded-full transition-colors",
                    checked ? "bg-blue-500" : "bg-white/20"
                )}
            >
                <div
                    className={cn(
                        "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform",
                        checked ? "translate-x-4" : "translate-x-0.5"
                    )}
                />
            </div>
        </label>
    );
}
