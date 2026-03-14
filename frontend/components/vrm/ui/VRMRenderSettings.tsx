import { LayoutGrid, Eye, Sparkles, Image as ImageIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/utils/cn';
import { useLanguage } from '@/contexts/LanguageContext';
import { useVRMStore } from '../../../store/vrm/useVRMStore';

/**
 * VRM 渲染设置面板
 * 提供实时切换渲染特性的 UI
 */
export function VRMRenderSettings({ className }: { className?: string }) {
    const { t } = useLanguage();
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    
    const { config, setRenderConfig, applySceneMode } = useVRMStore();

    return (
        <div className={cn(
            "bg-black/80 backdrop-blur-sm rounded-lg p-4 text-xs font-mono space-y-3 border border-white/10 shadow-lg min-w-[240px]",
            className
        )}>
            {/* 1. 场景预设 (核心层) */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-400 font-semibold mb-1">
                    <LayoutGrid className="w-3 h-3" />
                    <span>{t('vrm.scenePresets') || '场景预设'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {(['natural', 'cyber', 'studio', 'night'] as const).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => applySceneMode(mode)}
                            className={cn(
                                "py-2 px-3 rounded border transition-all text-center capitalize",
                                config.sceneMode === mode 
                                    ? "bg-blue-500/20 border-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]" 
                                    : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20"
                            )}
                        >
                            {t(`vrm.preset.${mode}`) || mode}
                        </button>
                    ))}
                </div>
            </div>

            <div className="border-t border-white/10" />

            {/* 2. 交互行为 (展现层) */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-400 font-semibold">
                    <Eye className="w-3 h-3" />
                    <span>{t('vrm.interactionBehavior') || '交互行为'}</span>
                </div>
                
                <ToggleItem
                    label={t('vrm.enableBlink')}
                    checked={config.enableBlink}
                    onChange={(checked) => setRenderConfig({ enableBlink: checked })}
                />

                <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-gray-400 uppercase tracking-widest">
                        <span>{t('vrm.lookAtMode')}</span>
                        <span className="text-blue-400 font-bold">{config.lookAtMode}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                        {(['mouse', 'camera', 'none'] as const).map((m) => (
                            <button
                                key={m}
                                onClick={() => setRenderConfig({ lookAtMode: m })}
                                className={cn(
                                    "py-1 text-[10px] rounded border transition-all",
                                    config.lookAtMode === m
                                        ? "bg-white/20 border-white/30 text-white"
                                        : "bg-white/5 border-white/5 text-gray-500 hover:text-gray-300"
                                )}
                            >
                                {t(`vrm.lookAt.${m}`) || m}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="border-t border-white/10" />

            {/* 3. 画面显示 (视觉层) */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-400 font-semibold text-[10px]">
                    <ImageIcon className="w-3 h-3" />
                    <span>{t('vrm.displaySettings') || '显示设置'}</span>
                </div>

                <ToggleItem
                    label={t('vrm.showBackground')}
                    checked={config.showEnvironmentBackground}
                    onChange={(checked) => setRenderConfig({ showEnvironmentBackground: checked })}
                />

                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-400">
                        <span>{t('vrm.backgroundBlur')}</span>
                        <span>{config.backgroundBlurriness.toFixed(1)}</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={config.backgroundBlurriness}
                        onChange={(e) => setRenderConfig({ backgroundBlurriness: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>
            </div>

            <div className="border-t border-white/10" />

            {/* 4. 高级设置 (折叠层) */}
            <div>
                <button 
                    onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                    className="flex items-center justify-between w-full text-gray-500 hover:text-gray-300 transition-colors text-[10px] uppercase font-bold"
                >
                    <div className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>{t('vrm.advancedSettings') || '高级渲染'}</span>
                    </div>
                    {isAdvancedOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {isAdvancedOpen && (
                    <div className="mt-3 space-y-3 pt-3 border-t border-white/5 animate-in fade-in slide-in-from-top-1">
                        <ToggleItem
                            label={t('vrm.enablePostProcessing')}
                            checked={config.enablePostProcessing}
                            onChange={(checked) => setRenderConfig({ enablePostProcessing: checked })}
                        />
                        
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-gray-400">
                                <span>{t('vrm.bloomIntensity')}</span>
                                <span>{config.bloomIntensity.toFixed(1)}</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                value={config.bloomIntensity}
                                onChange={(e) => setRenderConfig({ bloomIntensity: parseFloat(e.target.value) })}
                                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            <ToggleItem
                                label={t('vrm.shadows') || '阴影'}
                                checked={config.enableContactShadows}
                                onChange={(checked) => setRenderConfig({ enableContactShadows: checked })}
                            />
                            <ToggleItem
                                label={t('vrm.bloom') || '辉光'}
                                checked={config.enableBloom}
                                onChange={(checked) => setRenderConfig({ enableBloom: checked })}
                            />
                        </div>
                    </div>
                )}
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
