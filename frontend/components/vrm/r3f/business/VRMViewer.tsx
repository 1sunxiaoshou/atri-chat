import { Suspense, useRef, useImperativeHandle, forwardRef, useEffect, useCallback, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { VRMCanvas } from '../core/VRMCanvas';
import { StudioScene } from '../scenes/StudioScene';
import { Character } from '../core/Character';
import { cn } from '@/utils/cn';

interface VRMViewerProps {
    /** VRM 模型 URL（必需） */
    modelUrl: string;
    /** 动作文件 URL（可选） */
    motionUrl?: string | null;
    /** 表情名称（可选） */
    expression?: string;
    /** 音频元素（用于口型同步） */
    audioElement?: HTMLAudioElement | null;
    /** 是否启用口型同步 */
    enableLipSync?: boolean;
    /** 是否启用自动眨眼 */
    enableBlink?: boolean;
    /** 视线跟随模式 */
    lookAtMode?: 'mouse' | 'camera' | 'none';
    /** 是否循环播放动作 */
    loopMotion?: boolean;
    /** 动作播放完成回调（仅在非循环模式下触发） */
    onMotionComplete?: () => void;
    /** 是否显示控制栏（暂未实现，保留用于未来） */
    showControls?: boolean;
    /** 是否显示网格 */
    showGrid?: boolean;
    /** 是否启用轨道控制 */
    enableOrbitControls?: boolean;
    /** 是否启用相机自适应（默认 true） */
    enableCameraFit?: boolean;
    /** 是否启用自动旋转（默认 false） */
    autoRotate?: boolean;
    /** 自动旋转速度（默认 2.0） */
    autoRotateSpeed?: number;
    /** 自定义类名 */
    className?: string;
    /** 标题（显示在左上角） */
    title?: string;
    /** 模型加载完成回调 */
    onModelLoaded?: () => void;
}

export interface VRMViewerHandle {
    /** 截取当前画面为缩略图 */
    captureScreenshot: (width?: number, height?: number) => Promise<Blob>;
    /** 播放指定动作 */
    playMotion: (motionUrl: string, loop?: boolean, fadeDuration?: number) => void;
    /** 重新播放当前动作（强制重播） */
    replayMotion: () => void;
    /** 停止当前动作（实际上会切换到 null，由业务层决定是否播放 Idle） */
    stopMotion: () => void;
    /** 获取当前播放的动作 URL */
    getCurrentMotionUrl: () => string | null;
}

/**
 * 内部组件：用于访问 Three.js 渲染器
 */
function ScreenshotHelper({ onReady }: { onReady: (gl: THREE.WebGLRenderer) => void }) {
    const { gl } = useThree();

    useEffect(() => {
        if (gl) {
            onReady(gl);
        }
    }, [gl, onReady]);

    return null;
}

/**
 * VRM 大一统预览组件
 * 基于 R3F 渲染系统，支持模型预览、动作播放、表情控制
 * 
 * 使用场景：
 * - 模型预览：<VRMViewer modelUrl={url} />
 * - 动作预览：<VRMViewer modelUrl={defaultModel} motionUrl={motionUrl} />
 * - 表情预览：<VRMViewer modelUrl={url} expression="happy" />
 * 
 * 截图功能：
 * ```tsx
 * const viewerRef = useRef<VRMViewerHandle>(null);
 * const blob = await viewerRef.current?.captureScreenshot(512, 683);
 * ```
 */
export const VRMViewer = forwardRef<VRMViewerHandle, VRMViewerProps>(({
    modelUrl,
    motionUrl,
    expression,
    audioElement,
    enableLipSync = false,
    enableBlink = true,
    lookAtMode = 'mouse',
    loopMotion = true,
    onMotionComplete,
    showGrid = true,
    enableOrbitControls = true,
    enableCameraFit = true,
    autoRotate = false,
    autoRotateSpeed = 2.0,
    className,
    title,
}, ref) => {
    const glRef = useRef<THREE.WebGLRenderer | null>(null);
    const [internalMotionUrl, setInternalMotionUrl] = useState<string | null>(motionUrl || null);
    const [internalLoopMotion, setInternalLoopMotion] = useState<boolean>(loopMotion);

    // 同步外部 motionUrl 的变化
    useEffect(() => {
        setInternalMotionUrl(motionUrl || null);
    }, [motionUrl]);

    // 同步外部 loopMotion 的变化
    useEffect(() => {
        setInternalLoopMotion(loopMotion);
    }, [loopMotion]);

    // 使用 useCallback 稳定 onReady 函数引用
    const handleRendererReady = useCallback((gl: THREE.WebGLRenderer) => {
        glRef.current = gl;
    }, []);

    // 暴露截图和动作控制方法
    useImperativeHandle(ref, () => ({
        captureScreenshot: async (width = 512, height = 683) => {
            return new Promise<Blob>((resolve, reject) => {
                if (!glRef.current) {
                    reject(new Error('Renderer not ready'));
                    return;
                }

                const canvas = glRef.current.domElement;

                // 如果需要特定尺寸，创建临时 canvas
                if (width !== canvas.width || height !== canvas.height) {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = width;
                    tempCanvas.height = height;
                    const ctx = tempCanvas.getContext('2d');

                    if (!ctx) {
                        reject(new Error('Failed to get canvas context'));
                        return;
                    }

                    // 绘制并调整大小
                    ctx.drawImage(canvas, 0, 0, width, height);

                    tempCanvas.toBlob((blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Failed to create blob'));
                        }
                    }, 'image/jpeg', 0.9);
                } else {
                    // 直接使用原始 canvas
                    canvas.toBlob((blob: Blob | null) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Failed to create blob'));
                        }
                    }, 'image/jpeg', 0.9);
                }
            });
        },
        playMotion: (url: string, loop: boolean = true, fadeDuration: number = 0.5) => {
            setInternalMotionUrl(url);
            setInternalLoopMotion(loop);
        },
        replayMotion: () => {
            // 强制重新播放当前动作：先设置为 null，再恢复
            // 这会触发 Character 组件的 useEffect，从而调用 motionController.play()
            if (internalMotionUrl) {
                const currentUrl = internalMotionUrl;
                const currentLoop = internalLoopMotion;
                setInternalMotionUrl(null);
                setTimeout(() => {
                    setInternalMotionUrl(currentUrl);
                    setInternalLoopMotion(currentLoop);
                }, 50);
            }
        },
        stopMotion: () => {
            setInternalMotionUrl(null);
        },
        getCurrentMotionUrl: () => {
            return internalMotionUrl;
        }
    }), [internalMotionUrl]);

    return (
        <div className={cn(
            "relative bg-muted/30 rounded-lg overflow-hidden h-full",
            className
        )}>
            {/* R3F 渲染区域 */}
            <VRMCanvas transparent={true}>
                <ScreenshotHelper onReady={handleRendererReady} />
                <Suspense
                    fallback={
                        <mesh>
                            <boxGeometry args={[0.1, 0.1, 0.1]} />
                            <meshBasicMaterial color="gray" />
                        </mesh>
                    }
                >
                    <StudioScene
                        showGrid={showGrid}
                        enableControls={enableOrbitControls}
                        enableCameraFit={enableCameraFit}
                        autoRotate={autoRotate}
                        autoRotateSpeed={autoRotateSpeed}
                        intensity={1}
                    >
                        <Character
                            url={modelUrl}
                            expression={expression}
                            motionUrl={internalMotionUrl}
                            audioElement={audioElement}
                            enableLipSync={enableLipSync}
                            enableBlink={enableBlink}
                            lookAtMode={lookAtMode}
                            loopMotion={internalLoopMotion}
                            onMotionComplete={onMotionComplete}
                        />
                    </StudioScene>
                </Suspense>
            </VRMCanvas>

            {/* 标题标签 */}
            {title && (
                <div className="absolute top-4 left-4 z-10 pointer-events-none">
                    <div className="px-3 py-1.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-full border border-slate-100 dark:border-slate-700 shadow-sm">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 tracking-wide">
                            {title}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
});
