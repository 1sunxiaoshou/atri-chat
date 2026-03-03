import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { Play, Pause, RotateCcw, ZoomIn, ZoomOut, X } from 'lucide-react';
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

        initScene();
        loadVRMModel();

        return () => {
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

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1e293b);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(
            35,
            containerRef.current.clientWidth / containerRef.current.clientHeight,
            0.1,
            20
        );
        camera.position.set(0, 1, 2.5);
        camera.lookAt(0, 0.8, 0);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            antialias: true,
            alpha: true
        });
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        if (import.meta.env.DEV) {
            renderer.debug.checkShaderErrors = false;
        }

        rendererRef.current = renderer;

        const light = new THREE.DirectionalLight(0xffffff, Math.PI);
        light.position.set(1, 1, 1).normalize();
        scene.add(light);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const gridHelper = new THREE.GridHelper(10, 10, 0x3b82f6, 0x334155);
        gridHelper.position.y = 0;
        scene.add(gridHelper);

        const handleResize = () => {
            if (!containerRef.current || !camera || !renderer) return;
            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
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

            console.log(t('character.importingVRM'));
            const modelPath = '/static/defaults/mox.vrm';
            const gltf = await loader.loadAsync(modelPath);
            const vrm = gltf.userData.vrm as VRM;

            if (!vrm) {
                throw new Error(t('admin.loadDataFailed'));
            }

            console.log(t('admin.syncSuccess'));

            VRMUtils.rotateVRM0(vrm);
            sceneRef.current.add(vrm.scene);
            vrmRef.current = vrm;

            // 初始化 MotionController
            motionControllerRef.current = new MotionController(vrm, {
                maxSize: 20,
                enableAutoEvict: true
            });

            // 计算模型边界和位置
            const box = new THREE.Box3().setFromObject(vrm.scene);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            vrm.scene.position.x = -center.x;
            vrm.scene.position.y = -box.min.y;
            vrm.scene.position.z = -center.z;

            // 调整相机距离
            if (cameraRef.current) {
                const modelHeight = size.y;
                modelHeightRef.current = modelHeight;
                const distance = modelHeight * 1.5;
                initialCameraDistanceRef.current = distance;
                cameraRef.current.position.set(0, modelHeight * 0.5, distance);
                cameraRef.current.lookAt(0, modelHeight * 0.5, 0);
            }

            setIsLoading(false);

            // 加载初始动作
            if (motionUrl) {
                await loadMotion();
            }
        } catch (err) {
            console.error(t('admin.loadDataFailed'), err);
            setError(t('admin.loadDataFailed') + ': ' + (err as Error).message);
            setIsLoading(false);
        }
    };

    const loadMotion = async () => {
        if (!motionControllerRef.current) {
            console.warn(t('admin.noConfigRequired'));
            return;
        }

        try {
            console.log(t('admin.syncSuccess'), motionUrl);

            // 使用 MotionController 播放动作（不会重新加载模型）
            await motionControllerRef.current.playAnimationUrl(motionUrl, true);

            // 根据 autoPlay 决定是否自动播放
            setIsPlaying(autoPlay);

            console.log(t('admin.syncSuccess'));
        } catch (err) {
            console.error(t('admin.loadDataFailed'), err);
            setError(t('admin.loadDataFailed') + ': ' + (err as Error).message);
        }
    };

    const animate = () => {
        if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

        const delta = clockRef.current.getDelta();

        // 使用 MotionController 更新动画
        if (motionControllerRef.current && isPlayingRef.current) {
            motionControllerRef.current.update(delta);
        }

        // 更新 VRM
        if (vrmRef.current) {
            vrmRef.current.update(delta);
        }

        // 应用旋转
        if (vrmRef.current) {
            vrmRef.current.scene.rotation.y = rotationRef.current.y;
            vrmRef.current.scene.rotation.x = rotationRef.current.x;
        }

        // 应用缩放
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

        if (cameraRef.current) {
            const modelHeight = modelHeightRef.current;
            cameraRef.current.position.set(0, modelHeight * 0.5, initialCameraDistanceRef.current);
            cameraRef.current.lookAt(0, modelHeight * 0.5, 0);
        }
    };

    const handleZoomIn = () => {
        setZoom(prev => Math.min(3, prev + 0.2));
    };

    const handleZoomOut = () => {
        setZoom(prev => Math.max(0.5, prev - 0.2));
    };

    const handlePlayPause = () => {
        setIsPlaying(!isPlaying);
    };

    return (
        <div className={cn(
            "relative bg-slate-900 rounded-lg overflow-hidden h-full",
            className
        )}>
            <div
                ref={containerRef}
                className="w-full h-full cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <canvas ref={canvasRef} className="w-full h-full" />
            </div>

            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                        <p className="text-white text-sm">
                            {vrmRef.current ? t('admin.processing') : t('admin.loading')}
                        </p>
                    </div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                    <div className="text-center px-6">
                        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                            <X size={32} className="text-red-500" />
                        </div>
                        <p className="text-white text-sm">{error}</p>
                    </div>
                </div>
            )}

            {!isLoading && !error && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-800/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handlePlayPause}
                        className={cn(
                            "h-8 w-8 hover:bg-slate-700 hover:text-white",
                            isPlaying ? "text-blue-400" : "text-white"
                        )}
                        title={isPlaying ? t('character.pause') : t('character.play')}
                    >
                        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </Button>
                    <div className="w-px h-6 bg-slate-600" />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleZoomOut}
                        className="h-8 w-8 text-white hover:bg-slate-700 hover:text-white"
                        title={t('admin.cancel')}
                    >
                        <ZoomOut size={16} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleZoomIn}
                        className="h-8 w-8 text-white hover:bg-slate-700 hover:text-white"
                        title={t('admin.save')}
                    >
                        <ZoomIn size={16} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleReset}
                        className="h-8 w-8 text-white hover:bg-slate-700 hover:text-white"
                        title={t('admin.reset')}
                    >
                        <RotateCcw size={16} />
                    </Button>
                </div>
            )}

            {motionName && !isLoading && !error && (
                <div className="absolute top-4 left-4 bg-slate-800/90 backdrop-blur-sm rounded-lg px-3 py-2 text-sm text-white">
                    {motionName}
                </div>
            )}

            {!isLoading && !error && (
                <div className="absolute top-4 right-4 bg-slate-800/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-slate-300">
                    <p>{t('admin.tip')}</p>
                </div>
            )}
        </div>
    );
};
