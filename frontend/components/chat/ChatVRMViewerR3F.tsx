import React, { Suspense, useState, useMemo } from 'react';
import { VRMCanvas } from '../vrm/r3f/core/VRMCanvas';
import { AIStage } from '../vrm/r3f/scenes/AIStage';
import { Character } from '../vrm/r3f/core/Character';
import { VRMRenderSettings } from '../vrm/ui/VRMRenderSettings';
import { cn } from '@/utils/cn';
import { useLanguage } from '@/contexts/LanguageContext';
import { useVRMStore } from '@/store/vrm/useVRMStore';

interface ChatVRMViewerR3FProps {
    /** VRM 模型 URL */
    modelUrl: string;
    /** 音频元素（用于口型同步） */
    audioElement?: HTMLAudioElement | null;
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
 */
export const ChatVRMViewerR3F = React.memo(function ChatVRMViewerR3F({
    modelUrl,
    audioElement,
    className,
    onModelLoaded,
    onMotionComplete,
}: ChatVRMViewerR3FProps) {
    const { t } = useLanguage();

    // Zustand Store
    const renderConfig = useVRMStore((state) => state.config);
    const { subtitle } = useVRMStore((state) => state.runtime);

    const [showRenderSettings, setShowRenderSettings] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // 当模型 URL 变更时，重置加载状态
    React.useEffect(() => {
        setIsLoaded(false);
    }, [modelUrl]);

    // 内部模型加载回调包装
    const handleInternalModelLoaded = React.useCallback(() => {
        setIsLoaded(true);
        onModelLoaded?.();
    }, [onModelLoaded]);



    // 使用 useMemo 缓存 VRMCanvas 内容
    const vrmCanvasContent = useMemo(() => (
        <Suspense fallback={null}>
            <AIStage enableControls={true}>
                <Character
                    url={modelUrl}
                    audioElement={audioElement}
                    enableLipSync={true}
                    loopMotion={false}
                    onModelLoaded={handleInternalModelLoaded}
                    onMotionComplete={onMotionComplete}
                />
            </AIStage>
        </Suspense>
    ), [modelUrl, audioElement, handleInternalModelLoaded, onMotionComplete]);

    return (
        <div className={cn(
            "absolute inset-0 z-0 flex items-center justify-center overflow-hidden bg-transparent",
            className
        )}>
            {/* 背景加载提示 - 仅在未加载完成时显示 */}
            <div className={cn(
                "absolute inset-0 flex flex-col items-center justify-center z-0 transition-opacity duration-1000",
                isLoaded ? "opacity-0 pointer-events-none" : "opacity-100"
            )}>
                <p className="text-muted-foreground text-sm font-medium tracking-[0.2em] uppercase animate-pulse">
                    {t('vrm.avatar.loadingModel')}
                </p>
                <div className="mt-4 w-32 h-[1px] bg-gradient-to-r from-transparent via-muted-foreground/30 to-transparent" />
            </div>

            {/* R3F 渲染区域 */}
            <VRMCanvas
                camera={{ position: [0, 0.9, 2.2], fov: 35 }}
                transparent={true}
            >
                {vrmCanvasContent}
            </VRMCanvas>

            {/* 右上角按钮组 */}
            <div className="absolute top-4 right-4 z-20 flex gap-2">
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
                    <VRMRenderSettings />
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



export default ChatVRMViewerR3F;
