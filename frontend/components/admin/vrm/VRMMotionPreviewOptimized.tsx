import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { Play, Pause, RotateCcw, ZoomIn, ZoomOut, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../../ui';
import { cn } from '../../../utils/cn';
import { MotionController } from '../../../libs/vrm-emote/motionController';
import { useLanguage } from '../../../contexts/LanguageContext';

interface VRMMotionPreviewOptimizedProps {
    motionUrl: string;
    motionName?: string;
    className?: string;
    autoPlay?: boolean;
}

export const VRMMotionPreviewOptimized: React.FC<VRMMotionPreviewOptimizedProps> = ({
    motionUrl,
    motionName,
    className,
    autoPlay = false
}) => {
    const { t } = useLanguage();
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [isPlaying, setIsPlaying] = useState(false);

    // Three.js refs
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const vrmRef = useRef<VRM | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const initialCameraDistanceRef = useRef<number>(2.5);
    const modelHeightRef = useRef<number>(1.6);
    const clockRef = useRef<THREE.Clock>(new THREE.Clock());

    // 使用 MotionController 管理动作
    const motionControllerRef = useRef<MotionController | null>(null);

    // Interaction state
    const isDraggingRef = useRef(false);
    const previousMouseRef = useRef({ x: 0, y: 0 });
    const rotationRef = useRef({ x: 0, y: Math.PI });
    const zoomRef = useRef(1);
    const isPlayingRef = useRef(false);

    useEffect(() => {
        zoomRef.current = zoom;
    }, [zoom]);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    // 初始化场景和加载模型（只运行一次）
    useEffect(() => {
        if (!canvasRef.current || !containerRef.current) return;

        let cleanupFn: (() => void) | undefined;

        const checkVisibility = () => {
            if (containerRef.current && containerRef.current.clientWidth > 0) {
                initScene();
                loadVRMModel();
            } else {
                const observer = new ResizeObserver((entries) => {
                    for (const entry of entries) {
                        if (entry.contentRect.width > 0) {
                            observer.disconnect();
                            initScene();
                            loadVRMModel();
                        }
                    }
                });
                if (containerRef.current) {
                    observer.observe(containerRef.current);
                }
                cleanupFn = () => observer.disconnect();
            }
        };

        checkVisibility();

        return () => {
            if (cleanupFn) cleanupFn();
            cleanup();
        };
    }, []);

    // 当 motionUrl 改变时，只加载新动作，不重新加载模型
    useEffect(() => {
        if (motionControllerRef.current && motionUrl && !isLoading) {
            loadMotion();
        }
    }, [motionUrl]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setZoom(prev => Math.max(0.5, Math.min(3, prev + delta)));
        };

        container.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            container.removeEventListener('wheel', handleWheel);
        };
    }, []);

    const initScene = () => {
        if (!canvasRef.current || !containerRef.current) return;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        if (width === 0 || height === 0) return;

        // 如果已经有 renderer，先清理
        if (rendererRef.current) {
            rendererRef.current.dispose();
            rendererRef.current = null;
        }

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 20);
        camera.position.set(0, 1, 2.5);
        camera.lookAt(0, 0.8, 0);
        cameraRef.current = camera;

        try {
            const renderer = new THREE.WebGLRenderer({
                canvas: canvasRef.current,
                antialias: true,
                alpha: true
            });
            renderer.setSize(width, height);
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            rendererRef.current = renderer;
        } catch (error) {
            console.error('Failed to create WebGLRenderer:', error);
            setError(t('admin.loadDataFailed'));
            return;
        }

        const light = new THREE.DirectionalLight(0xffffff, Math.PI);
        light.position.set(1, 1, 1).normalize();
        scene.add(light);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        // 极淡的网格，几乎看不见，或者完全移除
        const gridHelper = new THREE.GridHelper(10, 10, 0xe2e8f0, 0xf1f5f9);
        gridHelper.position.y = 0;
        gridHelper.material.opacity = 0.3;
        gridHelper.material.transparent = true;
        scene.add(gridHelper);

        const handleResize = () => {
            if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;
            if (width === 0 || height === 0) return;
            cameraRef.current.aspect = width / height;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);

        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    };

    const loadVRMModel = async () => {
        if (!sceneRef.current) return;

        setIsLoading(true);
        setError(null);

        try {
            const loader = new GLTFLoader();
            loader.register((parser) => new VRMLoaderPlugin(parser));

            const modelPath = '/static/defaults/mox.vrm';
            const gltf = await loader.loadAsync(modelPath);
            const vrm = gltf.userData.vrm as VRM;

            if (!vrm) {
                throw new Error(t('admin.loadDataFailed'));
            }

            VRMUtils.rotateVRM0(vrm);
            sceneRef.current.add(vrm.scene);
            vrmRef.current = vrm;

            motionControllerRef.current = new MotionController(vrm, {
                maxSize: 20,
                enableAutoEvict: true
            });

            const box = new THREE.Box3().setFromObject(vrm.scene);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            vrm.scene.position.x = -center.x;
            vrm.scene.position.y = -box.min.y;
            vrm.scene.position.z = -center.z;

            if (cameraRef.current) {
                const modelHeight = size.y;
                modelHeightRef.current = modelHeight;
                const distance = modelHeight * 1.7;
                initialCameraDistanceRef.current = distance;
                cameraRef.current.position.set(0, modelHeight * 0.5, distance);
                cameraRef.current.lookAt(0, modelHeight * 0.5, 0);
            }

            setIsLoading(false);

            if (motionUrl) {
                await loadMotion();
            }
        } catch (err) {
            console.error(err);
            setError(t('admin.loadDataFailed'));
            setIsLoading(false);
        }
    };

    const loadMotion = async () => {
        if (!motionControllerRef.current) return;

        try {
            await motionControllerRef.current.playAnimationUrl(motionUrl, true);
            setIsPlaying(autoPlay);
        } catch (err) {
            console.error(err);
            setError(t('admin.loadDataFailed'));
        }
    };

    const animate = () => {
        if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

        const delta = clockRef.current.getDelta();

        if (motionControllerRef.current && isPlayingRef.current) {
            motionControllerRef.current.update(delta);
        }

        if (vrmRef.current) {
            vrmRef.current.update(delta);
        }

        if (vrmRef.current) {
            vrmRef.current.scene.rotation.y = rotationRef.current.y;
            vrmRef.current.scene.rotation.x = rotationRef.current.x;
        }

        if (cameraRef.current) {
            cameraRef.current.position.z = initialCameraDistanceRef.current / zoomRef.current;
        }

        rendererRef.current.render(sceneRef.current, cameraRef.current);
        animationFrameRef.current = requestAnimationFrame(animate);
    };

    const cleanup = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if (motionControllerRef.current) {
            motionControllerRef.current.dispose();
        }
        if (vrmRef.current && sceneRef.current) {
            sceneRef.current.remove(vrmRef.current.scene);
            VRMUtils.deepDispose(vrmRef.current.scene);
        }
        if (rendererRef.current) {
            rendererRef.current.dispose();
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        isDraggingRef.current = true;
        previousMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingRef.current) return;
        const deltaX = e.clientX - previousMouseRef.current.x;
        const deltaY = e.clientY - previousMouseRef.current.y;
        rotationRef.current.y += deltaX * 0.01;
        rotationRef.current.x += deltaY * 0.01;
        rotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationRef.current.x));
        previousMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
    };

    const handleReset = () => {
        rotationRef.current = { x: 0, y: Math.PI };
        setZoom(1);
    };

    const handlePlayPause = () => {
        setIsPlaying(!isPlaying);
    };

    return (
        <div className={cn(
            "relative bg-muted/30 rounded-lg overflow-hidden h-full",
            className
        )}>
            <div
                ref={containerRef}
                className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <canvas ref={canvasRef} className="w-full h-full block" />
            </div>

            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <span className="text-sm font-medium text-muted-foreground">{t('admin.loading')}</span>
                    </div>
                </div>
            )}

            {/* Error Overlay */}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                    <div className="flex flex-col items-center gap-2 text-destructive">
                        <AlertCircle className="w-8 h-8" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                </div>
            )}

            {/* Controls Bar - 亮色毛玻璃风格 */}
            {!isLoading && !error && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
                    <div className="flex items-center gap-1 p-1.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handlePlayPause}
                            className={cn(
                                "h-9 w-9 rounded-full transition-all hover:scale-105",
                                isPlaying
                                    ? "text-primary bg-primary/10 hover:bg-primary/20"
                                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            )}
                            title={isPlaying ? t('character.pause') : t('character.play')}
                        >
                            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                        </Button>

                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-1" />

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setZoom(prev => Math.max(0.5, prev - 0.2))}
                            className="h-9 w-9 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all hover:scale-105"
                            title={t('admin.cancel')}
                        >
                            <ZoomOut size={18} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setZoom(prev => Math.min(3, prev + 0.2))}
                            className="h-9 w-9 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all hover:scale-105"
                            title={t('admin.save')}
                        >
                            <ZoomIn size={18} />
                        </Button>

                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-1" />

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleReset}
                            className="h-9 w-9 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all hover:scale-105"
                            title={t('admin.reset')}
                        >
                            <RotateCcw size={18} />
                        </Button>
                    </div>
                </div>
            )}

            {/* Motion Name - 亮色标签 */}
            {motionName && !isLoading && !error && (
                <div className="absolute top-4 left-4 z-10 pointer-events-none">
                    <div className="px-3 py-1.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-full border border-slate-100 dark:border-slate-700 shadow-sm">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 tracking-wide">
                            {motionName}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};