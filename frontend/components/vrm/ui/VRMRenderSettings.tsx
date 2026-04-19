import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
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
    
    const { config, setRenderConfig } = useVRMStore();
    const backgroundOptions = [
        { value: 'none', label: t('vrm.background.none') },
        { value: 'BG_AronaRoom.jpg', label: t('vrm.background.aronaRoomOut') },
        { value: 'BG_AronaRoom_In.jpg', label: t('vrm.background.aronaRoomIn') },
        { value: 'BG_GameDevRoom.jpg', label: t('vrm.background.gameDevRoom') },
    ];

    return (
        <div className={cn(
            "bg-black/80 backdrop-blur-sm rounded-lg p-4 text-xs font-mono space-y-3 border border-white/10 shadow-lg min-w-[240px]",
            className
        )}>
            {/* 1. 光照控制 (核心渲染层) */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-400 font-semibold mb-1">
                    <Sparkles className="w-3 h-3 text-yellow-500" />
                    <span>{t('vrm.lightingSettings')}</span>
                </div>
                
                {/* 主光源控制 */}
                <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-gray-400">
                        <span>{t('vrm.mainLight')}</span>
                        <span className="text-blue-400 font-bold">{config.mainLightIntensity.toFixed(1)}</span>
                    </div>
                    <input
                        type="range" min="0" max="10" step="0.1"
                        value={config.mainLightIntensity}
                        onChange={(e) => setRenderConfig({ mainLightIntensity: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* 环境补光控制 */}
                <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-gray-400">
                        <span>{t('vrm.ambientLight')}</span>
                        <span className="text-emerald-400 font-bold">{config.ambientLightIntensity.toFixed(1)}</span>
                    </div>
                    <input
                        type="range" min="0" max="5" step="0.1"
                        value={config.ambientLightIntensity}
                        onChange={(e) => setRenderConfig({ ambientLightIntensity: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* 边缘补光控制 */}
                <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-gray-400">
                        <span>{t('vrm.rimLight')}</span>
                        <span className="text-purple-400 font-bold">{config.rimLightIntensity.toFixed(1)}</span>
                    </div>
                    <input
                        type="range" min="0" max="5" step="0.1"
                        value={config.rimLightIntensity}
                        onChange={(e) => setRenderConfig({ rimLightIntensity: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
            </div>

            <div className="border-t border-white/10" />

            {/* 2. 交互与背景 (展现层) */}
            <div className="space-y-3">
                <ToggleItem
                    label={t('vrm.enableBlink')}
                    checked={config.enableBlink}
                    onChange={(checked) => setRenderConfig({ enableBlink: checked })}
                />

                <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-gray-400 uppercase tracking-widest">
                        <span>{t('vrm.lookAtMode')}</span>
                        <span className="text-blue-400 font-bold">{t(`vrm.lookAt.${config.lookAtMode}`)}</span>
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
                                {t(`vrm.lookAt.${m}`)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest">{t('vrm.selectBackground')}</div>
                    <select
                        value={config.backgroundImage || 'none'}
                        onChange={(e) => setRenderConfig({ backgroundImage: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-gray-300 focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer hover:bg-white/10 transition-colors"
                    >
                        {backgroundOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
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
                        <span>{t('vrm.advancedSettings')}</span>
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
                                label={t('vrm.shadows')}
                                checked={config.enableContactShadows}
                                onChange={(checked) => setRenderConfig({ enableContactShadows: checked })}
                            />
                            <ToggleItem
                                label={t('vrm.bloom')}
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
