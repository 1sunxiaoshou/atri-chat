import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import { Play, Pause, RotateCcw, ZoomIn, ZoomOut, X } from 'lucide-react';
import { Button } from '../../ui';
import { cn } from '../../../utils/cn';

interface VRMMotionPreviewProps {
    motionUrl: string;
    motionName?: string;
    className?: string;
}

export const VRMMotionPreview: React.FC<VRMMotionPreviewProps> = ({
    motionUrl,
    motionName,
    className
}) => {
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
    const modelHeightRef = useRef<number>(1.6); // Store model height for reset
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const clockRef = useRef<THREE.Clock>(new THREE.Clock());

    // Interaction state
    const isDraggingRef = useRef(false);
    const previousMouseRef = useRef({ x: 0, y: 0 });
    const rotationRef = useRef({ x: 0, y: Math.PI }); // Start facing camera (180 degrees)
    const zoomRef = useRef(1);
    const isPlayingRef = useRef(false);

    useEffect(() => {
        zoomRef.current = zoom;
    }, [zoom]);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    useEffect(() => {
        if (!canvasRef.current || !containerRef.current) return;

        initScene();
        loadVRMModel(); // Load model once

        return () => {
            cleanup();
        };
    }, []); // Only run once on mount

    useEffect(() => {
        // Load motion when motionUrl changes
        if (vrmRef.current && motionUrl) {
            loadMotion();
        }
    }, [motionUrl]); // Reload motion when URL changes

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

            console.log('开始加载 VRM 模型...');
            // Load default VRM model
            const modelPath = '/static/defaults/mox.vrm';
            const gltf = await loader.loadAsync(modelPath);
            const vrm = gltf.userData.vrm as VRM;

            if (!vrm) {
                throw new Error('无效的VRM文件');
            }

            console.log('VRM 模型加载成功');

            // Add new VRM
            VRMUtils.rotateVRM0(vrm);
            sceneRef.current.add(vrm.scene);
            vrmRef.current = vrm;

            // Calculate bounding box and position model
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
                modelHeightRef.current = modelHeight; // Save for reset
                const distance = modelHeight * 1.5;
                initialCameraDistanceRef.current = distance;
                // Camera should be in front of the model (positive Z)
                cameraRef.current.position.set(0, modelHeight * 0.5, distance);
                cameraRef.current.lookAt(0, modelHeight * 0.5, 0);
            }

            // Create animation mixer
            mixerRef.current = new THREE.AnimationMixer(vrm.scene);

            setIsLoading(false);

            // Load initial motion if available
            if (motionUrl) {
                await loadMotion();
            }
        } catch (err) {
            console.error('加载模型失败:', err);
            setError('加载模型失败: ' + (err as Error).message);
            setIsLoading(false);
        }
    };

    const loadMotion = async () => {
        if (!vrmRef.current || !mixerRef.current) {
            console.warn('VRM 模型或 Mixer 未初始化');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log('开始加载动作文件:', motionUrl);
            // Load and apply motion animation with VRMAnimationLoaderPlugin
            const animationLoader = new GLTFLoader();
            animationLoader.register((parser) => new VRMAnimationLoaderPlugin(parser));

            const motionGltf = await animationLoader.loadAsync(motionUrl);
            const vrmAnimations = motionGltf.userData?.vrmAnimations;

            console.log('动作文件加载成功');
            console.log('userData:', motionGltf.userData);
            console.log('VRM Animations:', vrmAnimations);

            // Stop current animation
            mixerRef.current.stopAllAction();

            // Use VRM animations with createVRMAnimationClip
            if (vrmAnimations && Array.isArray(vrmAnimations) && vrmAnimations.length > 0) {
                console.log('使用 VRM 动画，数量:', vrmAnimations.length);

                // Create VRM animation clip for the VRM model
                const clip = createVRMAnimationClip(vrmAnimations[0], vrmRef.current);
                console.log('创建 VRM 动画剪辑:', clip.name, '时长:', clip.duration);

                const action = mixerRef.current.clipAction(clip);
                action.loop = THREE.LoopRepeat;
                action.play();
                mixerRef.current.timeScale = 0; // Start paused
                setIsPlaying(false); // Reset playing state
                console.log('VRM 动画已设置（暂停状态）');
            } else {
                console.warn('动作文件中没有找到 VRM 动画');
                console.warn('userData keys:', Object.keys(motionGltf.userData || {}));
            }

            setIsLoading(false);
        } catch (err) {
            console.error('加载动作失败:', err);
            setError('加载动作失败: ' + (err as Error).message);
            setIsLoading(false);
        }
    };

    const animate = () => {
        if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

        const delta = clockRef.current.getDelta();

        // Update animation mixer
        if (mixerRef.current && isPlayingRef.current) {
            mixerRef.current.update(delta);
        }

        // Update VRM
        if (vrmRef.current) {
            vrmRef.current.update(delta);
        }

        // Apply rotation to the entire VRM scene
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
        if (mixerRef.current) {
            mixerRef.current.stopAllAction();
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
        rotationRef.current = { x: 0, y: Math.PI }; // Reset to face camera
        setZoom(1);

        // Reset camera to front view using saved model height
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
        const newPlayingState = !isPlaying;
        setIsPlaying(newPlayingState);
        console.log('播放状态切换:', newPlayingState ? '播放' : '暂停');

        if (mixerRef.current) {
            if (newPlayingState) {
                // Start playing
                mixerRef.current.timeScale = 1;
                console.log('动画开始播放');
            } else {
                // Pause
                mixerRef.current.timeScale = 0;
                console.log('动画已暂停');
            }
        } else {
            console.warn('AnimationMixer 未初始化');
        }
    };

    return (
        <div className={cn(
            "relative bg-slate-900 rounded-lg overflow-hidden h-full",
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
                        <p className="text-white text-sm">加载动作中...</p>
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
                        onClick={handlePlayPause}
                        className={cn(
                            "h-8 w-8 hover:bg-slate-700 hover:text-white",
                            isPlaying ? "text-blue-400" : "text-white"
                        )}
                        title={isPlaying ? "暂停" : "播放"}
                    >
                        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </Button>
                    <div className="w-px h-6 bg-slate-600" />
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

            {/* Motion Name */}
            {motionName && !isLoading && !error && (
                <div className="absolute top-4 left-4 bg-slate-800/90 backdrop-blur-sm rounded-lg px-3 py-2 text-sm text-white">
                    {motionName}
                </div>
            )}

            {/* Instructions */}
            {!isLoading && !error && (
                <div className="absolute top-4 right-4 bg-slate-800/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-slate-300">
                    <p>拖拽旋转 • 滚轮缩放</p>
                </div>
            )}
        </div>
    );
};
