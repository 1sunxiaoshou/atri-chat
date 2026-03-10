import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { VRMCanvas } from '../vrm/r3f/core/VRMCanvas';
import { AIStage } from '../vrm/r3f/scenes/AIStage';
import { Character } from '../vrm/r3f/core/Character';
import { PerformanceMonitor, PerformanceOverlay, PerformanceStats } from '../vrm/PerformanceMonitor';
import { VRMRenderSettings, VRMRenderConfig, DEFAULT_VRM_RENDER_CONFIG } from '../vrm/VRMRenderSettings';
import { STORAGE_KEYS } from '@/utils/constants';
import { cn } from '@/utils/cn';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

interface ChatVRMViewerR3FProps {
    /** VRM 模型 URL */
    modelUrl: string;
    /** 音频元素（用于口型同步） */
    audioElement?: HTMLAudioElement | null;
    /** 当前表情 */
    expression?: string;
    /** 当前动作 URL */
    motionUrl?: string | null;
    /** 字幕文本 */
    subtitle?: string;
    /** 自定义类名 */
    className?: string;
    /** 模型加载完成回调 */
    onModelLoaded?: () => void;
    /** 动作播放完成回调 */
    onMotionComplete?: () => void;
}

/**
 * 聊天界面专用 VRM 渲染组件
 * 基于 R3F 架构，提供沉浸式 AI 对话体验
 * 
 * 功能：
 * - 实时口型同步（TTS 音频驱动）
 * - 情感表情映射（AI 情感 → VRM 表情）
 * - 动作状态绑定（思考/闲置 → 动作播放）
 * - 优化的视觉效果（平衡性能和质量）
 * - 性能监控（画布内控制）
 */
export const ChatVRMViewerR3F = React.memo(function ChatVRMViewerR3F({
    modelUrl,
    audioElement,
    expression = 'neutral',
    motionUrl,
    subtitle,
    className,
    onModelLoaded,
    onMotionComplete,
}: ChatVRMViewerR3FProps) {
    const { t } = useLanguage();
    const { isDark } = useTheme();

    // 性能监控状态（本地控制）
    const [isPerformanceVisible, setIsPerformanceVisible] = useState(false);

    const [perfStats, setPerfStats] = useState<PerformanceStats>({
        fps: 0,
        frameTime: 0,
        memory: 0,
        heapTotal: 0,
        memoryGrowth: 0,
        cachedModels: 0,
        cachedMotions: 0,
        cachedBindings: 0,
        motionCacheSize: 20,
        motionCacheHitRate: 0,
        geometries: 0,
        textures: 0,
        materials: 0,
        programs: 0,
        drawCalls: 0,
        triangles: 0,
        activeAnimations: 0,
        currentMotion: '',
        audioContextCount: 0,
    });

    // 渲染配置状态
    const [renderConfig, setRenderConfig] = useState<VRMRenderConfig>(DEFAULT_VRM_RENDER_CONFIG);
    const [showRenderSettings, setShowRenderSettings] = useState(false);

    // 从 localStorage 加载渲染配置
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEYS.VRM_RENDER_CONFIG);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // 合并默认配置和保存的配置，确保新字段有默认值
                setRenderConfig({ ...DEFAULT_VRM_RENDER_CONFIG, ...parsed });
            } catch (e) {
                console.error('Failed to parse render config:', e);
            }
        }
    }, []);

    // 保存渲染配置到 localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.VRM_RENDER_CONFIG, JSON.stringify(renderConfig));
    }, [renderConfig]);

    // 使用 useMemo 缓存 VRMCanvas 内容，避免性能监控更新导致重新渲染
    const vrmCanvasContent = useMemo(() => (
        <>
            <Suspense fallback={null}>
                <AIStage config={renderConfig} enableControls={true}>
                    <Character
                        url={modelUrl}
                        expression={expression}
                        motionUrl={motionUrl}
                        audioElement={audioElement}
                        enableLipSync={true}
                        enableBlink={renderConfig.enableBlink}
                        lookAtMode={renderConfig.lookAtMode}
                        loopMotion={false}
                        onModelLoaded={onModelLoaded}
                        onMotionComplete={onMotionComplete}
                    />
                </AIStage>
            </Suspense>

            {/* 性能监控（内部组件） */}
            {isPerformanceVisible && <PerformanceMonitorInternal onUpdate={setPerfStats} />}
        </>
    ), [modelUrl, expression, motionUrl, audioElement, renderConfig, isPerformanceVisible, onModelLoaded, onMotionComplete]);

    return (
        <div className={cn(
            "absolute inset-0 z-0 flex items-center justify-center overflow-hidden",
            // 动态背景：如果显示环境背景则透明，否则根据主题使用渐变
            renderConfig.showEnvironmentBackground
                ? "bg-transparent"
                : isDark
                    ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
                    : "bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200",
            className
        )}>
            {/* R3F 渲染区域 */}
            <VRMCanvas
                camera={{ position: [0, 0.9, 2.2], fov: 35 }}
                transparent={!renderConfig.showEnvironmentBackground}
            >
                {vrmCanvasContent}
            </VRMCanvas>

            {/* 性能监控 UI */}
            {isPerformanceVisible && <PerformanceOverlay stats={perfStats} />}

            {/* 右上角按钮组 */}
            <div className="absolute top-4 right-4 z-20 flex gap-2">
                {/* 性能监控按钮 */}
                <button
                    onClick={() => setIsPerformanceVisible(!isPerformanceVisible)}
                    className={cn(
                        "p-2 rounded-lg transition-colors",
                        "bg-black/60 hover:bg-black/80 backdrop-blur-sm",
                        "border border-white/10 shadow-lg",
                        isPerformanceVisible && "bg-blue-500/80 hover:bg-blue-500"
                    )}
                    title={t('settings.enablePerformanceMonitor')}
                >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                </button>

                {/* 渲染设置按钮 */}
                <button
                    onClick={() => setShowRenderSettings(!showRenderSettings)}
                    className={cn(
                        "p-2 rounded-lg transition-colors",
                        "bg-black/60 hover:bg-black/80 backdrop-blur-sm",
                        "border border-white/10 shadow-lg",
                        showRenderSettings && "bg-blue-500/80 hover:bg-blue-500"
                    )}
                    title={t('vrm.renderSettings')}
                >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
            </div>

            {/* 渲染设置面板 */}
            {showRenderSettings && (
                <div className="absolute top-16 right-4 z-20 max-h-[calc(100vh-15rem)] overflow-y-auto scrollbar-hide rounded-lg">
                    <VRMRenderSettings
                        config={renderConfig}
                        onChange={setRenderConfig}
                    />
                </div>
            )}

            {/* 字幕叠加层 */}
            <div className={cn(
                "absolute bottom-28 left-0 right-0 p-4 text-center z-10 pointer-events-none transition-all duration-500",
                subtitle ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}>
                {subtitle && (
                    <div className="inline-block bg-black/60 text-white px-8 py-4 rounded-2xl text-lg md:text-xl font-medium backdrop-blur-md shadow-2xl border border-white/10 max-w-[85%] leading-relaxed animate-in fade-in zoom-in-95 duration-300">
                        {subtitle}
                    </div>
                )}
            </div>

            {/* 环境渐变（增加深度感） - 仅在显示环境背景时启用 */}
            {renderConfig.showEnvironmentBackground && (
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/20 via-transparent to-black/10" />
            )}
        </div>
    );
});

/**
 * 内部性能监控组件
 * 在 R3F Canvas 内部运行
 */
function PerformanceMonitorInternal({ onUpdate }: { onUpdate: (stats: any) => void }) {
    return <PerformanceMonitor onUpdate={onUpdate} />;
}
