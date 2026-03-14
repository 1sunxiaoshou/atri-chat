import React from 'react';
import { ChatVRMViewerR3F } from './ChatVRMViewerR3F';
import { useLanguage } from '@/contexts/LanguageContext';

interface VRMViewerWrapperProps {
    modelUrl: string | null;
    audioElement?: HTMLAudioElement | null;
    activeCharacterId?: string;
    onModelLoaded?: () => void;
    onMotionComplete?: () => void;
}

/**
 * VRM 渲染包装组件
 * 使用 React.memo 完全隔离 3D 渲染，防止输入框输入影响性能
 */
export const VRMViewerWrapper = React.memo(function VRMViewerWrapper({
    modelUrl,
    audioElement,
    activeCharacterId,
    onModelLoaded,
    onMotionComplete,
}: VRMViewerWrapperProps) {
    const { t } = useLanguage();

    if (!modelUrl) {
        return (
            <div className="absolute inset-0 z-0 flex items-center justify-center bg-background">
                <div className="text-center space-y-4 px-6">
                    <div className="w-24 h-24 mx-auto rounded-full bg-muted border border-border flex items-center justify-center">
                        <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    <div className="space-y-2">
                        <p className="text-foreground text-lg font-medium">
                            {t('vrm.noModelConfigured')}
                        </p>
                        <p className="text-muted-foreground text-sm">
                            {t('vrm.configureModelHint')}
                        </p>
                    </div>
                    {activeCharacterId && (
                        <button
                            onClick={() => {
                                console.log('Navigate to character edit:', activeCharacterId);
                            }}
                            className="mt-4 px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors text-sm font-medium"
                        >
                            {t('vrm.configureModel')}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <ChatVRMViewerR3F
            modelUrl={modelUrl}
            audioElement={audioElement}
            onModelLoaded={onModelLoaded}
            onMotionComplete={onMotionComplete}
        />
    );
}, (prevProps, nextProps) => {
    // 自定义比较函数：只有这些属性变化时才重新渲染
    return (
        prevProps.modelUrl === nextProps.modelUrl &&
        prevProps.audioElement === nextProps.audioElement &&
        prevProps.activeCharacterId === nextProps.activeCharacterId &&
        prevProps.onModelLoaded === nextProps.onModelLoaded &&
        prevProps.onMotionComplete === nextProps.onMotionComplete
    );
});
