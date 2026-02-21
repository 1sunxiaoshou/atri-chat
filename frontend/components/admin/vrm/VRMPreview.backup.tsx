import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { RotateCcw, ZoomIn, ZoomOut, Maximize2, X, Play, Pause } from 'lucide-react';
import { Button } from '../../ui';
import { cn } from '../../../utils/cn';

interface VRMPreviewProps {
    modelUrl: string;
    className?: string;
    onClose?: () => void;
    fullscreen?: boolean;
    autoRotate?: boolean;  // 是否自动旋转
}

export const VRMPreview: React.FC<VRMPreviewProps> = ({
    modelUrl,
    className,
    onClose,
    fullscreen = false,
    autoRotate = false
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [isAutoRotating, setIsAutoRotating] = useState(autoRotate);

    // Three.js refs
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const vrmRef = useRef<VRM | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const initialCameraDistanceRef = useRef<number>(2.5);

    // Interaction state
    const isDraggingRef = useRef(false);
    const previousMouseRef = useRef({ x: 0, y: 0 });
    const rotationRef = useRef({ x: 0, y: Math.PI }); // Start facing camera (180 degrees)
    const zoomRef = useRef(1);
    const isAutoRotatingRef = useRef(autoRotate);

    // Sync zoom state to ref
    useEffect(() => {
        zoomRef.current = zoom;
    }, [zoom]);

    // Sync autoRotate state to ref
    useEffect(() => {
        isAutoRotatingRef.current = isAutoRotating;
    }, [isAutoRotating]);

    useEffect(() => {
        if (!canvasRef.current || !containerRef.current) return;

        initScene();
        loadVRM();

        return () => {
            cleanup();
        };
    }, [modelUrl]);

    // Separate effect for wheel event listener
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

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1e293b);
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(
            35,
            containerRef.current.clientWidth / containerRef.current.clientHeight,
            0.1,
            20
        );
        camera.position.set(0, 1, 2.5);
        camera.lookAt(0, 0.8, 0);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            antialias: true,
            alpha: true
        });
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        // Suppress shader compilation warnings in development
        if (import.meta.env.DEV) {
            renderer.debug.checkShaderErrors = false;
        }

        rendererRef.current = renderer;

        // Lights
        const light = new THREE.DirectionalLight(0xffffff, Math.PI);
        light.position.set(1, 1, 1).normalize();
        scene.add(light);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        // Grid helper
        const gridHelper = new THREE.GridHelper(10, 10, 0x3b82f6, 0x334155);
        gridHelper.position.y = 0;
        scene.add(gridHelper);

        // Handle resize
        const handleResize = () => {
            if (!containerRef.current || !camera || !renderer) return;
            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);

        // Start animation loop
        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    };

    const loadVRM = async () => {
        if (!sceneRef.current) return;

        setIsLoading(true);
        setError(null);

        try {
            const loader = new GLTFLoader();
            loader.register((parser) => new VRMLoaderPlugin(parser));

            const gltf = await loader.loadAsync(modelUrl);
            const vrm = gltf.userData.vrm as VRM;

            if (!vrm) {
                throw new Error('无效的VRM文件');
            }

            // Remove previous VRM
            if (vrmRef.current) {
                sceneRef.current.remove(vrmRef.current.scene);
                VRMUtils.deepDispose(vrmRef.current.scene);
            }

            // Add new VRM
            VRMUtils.rotateVRM0(vrm);
            sceneRef.current.add(vrm.scene);
            vrmRef.current = vrm;

            // Calculate bounding box
            const box = new THREE.Box3().setFromObject(vrm.scene);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // Position model so its bottom is on the ground (y=0)
            vrm.scene.position.x = -center.x;
            vrm.scene.position.y = -box.min.y;
            vrm.scene.position.z = -center.z;

            // Adjust camera distance based on model height
            if (cameraRef.current) {
                const modelHeight = size.y;
                const distance = modelHeight * 1.5; // 1.5x model height for good framing
                initialCameraDistanceRef.current = distance;
                cameraRef.current.position.set(0, modelHeight * 0.5, distance);
                cameraRef.current.lookAt(0, modelHeight * 0.5, 0);
            }

            setIsLoading(false);
        } catch (err) {
            console.error('加载VRM失败:', err);
            setError('加载3D模型失败');
            setIsLoading(false);
        }
    };

    const animate = () => {
        if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

        // Auto rotation
        if (isAutoRotatingRef.current && vrmRef.current) {
            rotationRef.current.y += 0.01;
        }

        // Apply rotation
        if (vrmRef.current) {
            vrmRef.current.scene.rotation.y = rotationRef.current.y;
            vrmRef.current.scene.rotation.x = rotationRef.current.x;
        }

        // Apply zoom
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
        if (vrmRef.current && sceneRef.current) {
            sceneRef.current.remove(vrmRef.current.scene);
            VRMUtils.deepDispose(vrmRef.current.scene);
        }
        if (rendererRef.current) {
            rendererRef.current.dispose();
        }
    };

    // Mouse interaction handlers
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

        // Clamp X rotation
        rotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationRef.current.x));

        previousMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
    };

    const handleReset = () => {
        rotationRef.current = { x: 0, y: Math.PI }; // Reset to face camera
        setZoom(1);

        // Reset camera to front view
        if (cameraRef.current && vrmRef.current) {
            const box = new THREE.Box3().setFromObject(vrmRef.current.scene);
            const size = box.getSize(new THREE.Vector3());
            const modelHeight = size.y;
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
            "relative bg-slate-900 rounded-xl overflow-hidden",
            fullscreen && "fixed inset-0 z-50 rounded-none",
            className
        )}>
            {/* Canvas Container */}
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

            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                        <p className="text-white text-sm">加载3D模型中...</p>
                    </div>
                </div>
            )}

            {/* Error Overlay */}
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

            {/* Controls */}
            {!isLoading && !error && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-800/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleZoomOut}
                        className="h-8 w-8 text-white hover:bg-slate-700 hover:text-white"
                        title="缩小"
                    >
                        <ZoomOut size={16} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleZoomIn}
                        className="h-8 w-8 text-white hover:bg-slate-700 hover:text-white"
                        title="放大"
                    >
                        <ZoomIn size={16} />
                    </Button>
                    <div className="w-px h-6 bg-slate-600" />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsAutoRotating(!isAutoRotating)}
                        className={cn(
                            "h-8 w-8 hover:bg-slate-700 hover:text-white",
                            isAutoRotating ? "text-blue-400" : "text-white"
                        )}
                        title={isAutoRotating ? "暂停旋转" : "自动旋转"}
                    >
                        {isAutoRotating ? <Pause size={16} /> : <Play size={16} />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleReset}
                        className="h-8 w-8 text-white hover:bg-slate-700 hover:text-white"
                        title="重置视角"
                    >
                        <RotateCcw size={16} />
                    </Button>
                </div>
            )}

            {/* Close Button (fullscreen only) */}
            {fullscreen && onClose && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="absolute top-4 right-4 h-10 w-10 text-white hover:bg-slate-700 hover:text-white"
                    title="关闭"
                >
                    <X size={20} />
                </Button>
            )}

            {/* Instructions */}
            {!isLoading && !error && (
                <div className="absolute top-4 left-4 bg-slate-800/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-slate-300">
                    <p>拖拽旋转 • 滚轮缩放</p>
                </div>
            )}
        </div>
    );
};
