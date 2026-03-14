import React from 'react';
import { VRMViewerWrapper } from './VRMViewerWrapper';

interface VRMChatModeProps {
    modelUrl: string | null;
    audioElement?: HTMLAudioElement | null;
    activeCharacterId?: string;
    onModelLoaded?: () => void;
    onMotionComplete?: () => void;
}

/**
 * VRM聊天模式组件
 * 完全隔离的VRM渲染，不包含任何MessageList相关逻辑
 * 使用React.memo确保只有VRM相关props变化时才重渲染
 */
export const VRMChatMode = React.memo(function VRMChatMode({
    modelUrl,
    audioElement,
    activeCharacterId,
    onModelLoaded,
    onMotionComplete,
}: VRMChatModeProps) {
    return (
        <VRMViewerWrapper
            modelUrl={modelUrl}
            audioElement={audioElement}
            activeCharacterId={activeCharacterId}
            onModelLoaded={onModelLoaded}
            onMotionComplete={onMotionComplete}
        />
    );
}, (prevProps, nextProps) => {
    // 自定义比较函数：只有VRM相关属性变化时才重新渲染
    return (
        prevProps.modelUrl === nextProps.modelUrl &&
        prevProps.audioElement === nextProps.audioElement &&
        prevProps.activeCharacterId === nextProps.activeCharacterId &&
        prevProps.onModelLoaded === nextProps.onModelLoaded &&
        prevProps.onMotionComplete === nextProps.onMotionComplete
    );
});