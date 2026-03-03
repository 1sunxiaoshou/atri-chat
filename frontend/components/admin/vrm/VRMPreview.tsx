import React, { useEffect, useRef, useState, memo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { RotateCcw, Play, Pause, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '../../ui';
import { cn } from '../../../utils/cn';

interface VRMPreviewProps {
    modelUrl: string;
    className?: string;
    autoRotate?: boolean;
}

export const VRMPreview: React.FC<VRMPreviewProps> = memo(({
    modelUrl,
    className,
    autoRotate = false,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [isAutoRotating, setIsAutoRotating] = useState(autoRotate);

    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const vrmRef = useRef<VRM | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const initialCameraDistanceRef = useRef<number>(2.5);
    const modelHeightRef = useRef<number>(1.6);

    const isDraggingRef = useRef(false);
    const previousMouseRef = useRef({ x: 0, y: 0 });
    const rotationRef = useRef({ x: 0, y: Math.PI });
    const isAutoRotatingRef = useRef(autoRotate);
    const zoomRef = useRef(1);

    useEffect(() => {
        isAutoRotatingRef.current = isAutoRotating;
    }, [isAutoRotating]);

    useEffect(() => {
        zoomRef.current = zoom;
    }, [zoom]);

    // 修复滚轮：手动绑定非 Passive 监听
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setZoom(prev => Math.max(0.5, Math.min(3, prev + delta)));
        };

        container.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            container.removeEventListener('wheel', handleWheel);
        };
    }, []);

    useEffect(() => {
        if (!canvasRef.current || !containerRef.current) return;
        initScene();
        loadVRM();
        return () => cleanup();
    }, [modelUrl]);

    const initScene = () => {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1e293b); // 与 VRMMotionPreviewOptimized 一致
        sceneRef.current = scene;

        // 与 VRMMotionPreviewOptimized 一致的相机设置
        const camera = new THREE.PerspectiveCamera(
            40, // 从 35 增加到 40，视野更广
            containerRef.current!.clientWidth / containerRef.current!.clientHeight,
            0.1,
            20
        );
        camera.position.set(0, 1, 2.5);
        camera.lookAt(0, 0.8, 0);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current!,
            antialias: true,
            alpha: true
        });

        renderer.setSize(containerRef.current!.clientWidth, containerRef.current!.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        // 禁用开发环境的 shader 错误检查
        if (import.meta.env.DEV) {
            renderer.debug.checkShaderErrors = false;
        }

        rendererRef.current = renderer;

        // 与 VRMMotionPreviewOptimized 一致的光照设置
        const light = new THREE.DirectionalLight(0xffffff, Math.PI);
        light.position.set(1, 1, 1).normalize();
        scene.add(light);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        // 添加网格辅助线
        const gridHelper = new THREE.GridHelper(10, 10, 0x3b82f6, 0x334155);
        gridHelper.position.y = 0;
        scene.add(gridHelper);

        const animate = () => {
            if (isAutoRotatingRef.current) rotationRef.current.y += 0.006;
            if (vrmRef.current) {
                vrmRef.current.scene.rotation.y = rotationRef.current.y;
                vrmRef.current.scene.rotation.x = rotationRef.current.x;
            }
            if (cameraRef.current && initialCameraDistanceRef.current) {
                const targetZ = initialCameraDistanceRef.current / zoomRef.current;
                cameraRef.current.position.z = targetZ;
            }
            renderer.render(scene, camera);
            animationFrameRef.current = requestAnimationFrame(animate);
        };
        animate();
    };

    const loadVRM = async () => {
        setIsLoading(true);
        try {
            const loader = new GLTFLoader();
            loader.register((parser) => new VRMLoaderPlugin(parser));
            const gltf = await loader.loadAsync(modelUrl);
            const vrm = gltf.userData.vrm as VRM;

            if (!vrm) {
                throw new Error(t('admin.loadDataFailed'));
            }

            VRMUtils.rotateVRM0(vrm);
            sceneRef.current?.add(vrm.scene);
            vrmRef.current = vrm;

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
                const distance = modelHeight * 1.7;
                initialCameraDistanceRef.current = distance;
                cameraRef.current.position.set(0, modelHeight * 0.5, distance);
                cameraRef.current.lookAt(0, modelHeight * 0.5, 0);
            }

            setIsLoading(false);
        } catch (e) {
            console.error(t('admin.loadDataFailed'), e);
            setIsLoading(false);
        }
    };

    const cleanup = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (vrmRef.current) {
            VRMUtils.deepDispose(vrmRef.current.scene);
            vrmRef.current = null;
        }
        if (rendererRef.current) {
            rendererRef.current.dispose();
            rendererRef.current.forceContextLoss();
            rendererRef.current = null;
        }
        sceneRef.current = null;
        cameraRef.current = null;
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

    return (
        <div className={cn(
            "relative bg-slate-900 rounded-lg overflow-hidden h-full",
            className
        )}>
            {/* 鼠标交互区 */}
            <div
                ref={containerRef}
                className="w-full h-full cursor-grab active:cursor-grabbing"
                onMouseDown={(e) => {
                    isDraggingRef.current = true;
                    previousMouseRef.current = { x: e.clientX, y: e.clientY };
                }}
                onMouseMove={(e) => {
                    if (!isDraggingRef.current) return;

                    const deltaX = e.clientX - previousMouseRef.current.x;
                    const deltaY = e.clientY - previousMouseRef.current.y;

                    rotationRef.current.y += deltaX * 0.01;
                    rotationRef.current.x += deltaY * 0.01;

                    rotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationRef.current.x));

                    previousMouseRef.current = { x: e.clientX, y: e.clientY };
                }}
                onMouseUp={() => isDraggingRef.current = false}
                onMouseLeave={() => isDraggingRef.current = false}
            >
                <canvas ref={canvasRef} className="w-full h-full" />
            </div>

            {/* 加载状态 */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                        <p className="text-white text-sm">{t('admin.loading')}</p>
                    </div>
                </div>
            )}

            {/* 底部控制栏 - 与 VRMMotionPreviewOptimized 完全一致 */}
            {!isLoading && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-800/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsAutoRotating(!isAutoRotating)}
                        className={cn(
                            "h-8 w-8 hover:bg-slate-700 hover:text-white",
                            isAutoRotating ? "text-blue-400" : "text-white"
                        )}
                        title={isAutoRotating ? t('admin.cancel') : t('admin.save')}
                    >
                        {isAutoRotating ? <Pause size={16} /> : <Play size={16} />}
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
        </div>
    );
});

VRMPreview.displayName = 'VRMPreview';
