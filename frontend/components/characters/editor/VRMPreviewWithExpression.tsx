import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { ExpressionController } from '../../../libs/vrm-emote/expressionController';

interface VRMPreviewWithExpressionProps {
    modelUrl: string;
    className?: string;
    autoRotate?: boolean;
}

export interface VRMPreviewWithExpressionHandle {
    loadExpression: (name: string) => void;
}

export const VRMPreviewWithExpression = forwardRef<VRMPreviewWithExpressionHandle, VRMPreviewWithExpressionProps>(
    ({ modelUrl, className, autoRotate = false }, ref) => {
        const containerRef = useRef<HTMLDivElement>(null);
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const [isLoading, setIsLoading] = useState(true);

        const sceneRef = useRef<THREE.Scene | null>(null);
        const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
        const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
        const vrmRef = useRef<VRM | null>(null);
        const expressionControllerRef = useRef<ExpressionController | null>(null);
        const animationFrameRef = useRef<number | null>(null);
        const initialCameraDistanceRef = useRef<number>(2.5);
        const clockRef = useRef<THREE.Clock>(new THREE.Clock());

        const rotationRef = useRef({ x: 0, y: Math.PI });

        // 暴露给父组件的方法
        useImperativeHandle(ref, () => ({
            loadExpression: (name: string) => {
                if (expressionControllerRef.current) {
                    expressionControllerRef.current.playEmotion(name);
                }
            }
        }));

        useEffect(() => {
            if (!canvasRef.current || !containerRef.current) return;

            const checkVisibility = () => {
                if (containerRef.current && containerRef.current.clientWidth > 0) {
                    initScene();
                    loadVRM();
                } else {
                    const observer = new ResizeObserver((entries) => {
                        for (const entry of entries) {
                            if (entry.contentRect.width > 0) {
                                observer.disconnect();
                                initScene();
                                loadVRM();
                            }
                        }
                    });
                    if (containerRef.current) {
                        observer.observe(containerRef.current);
                    }
                }
            };

            checkVisibility();

            return () => {
                cleanup();
            };
        }, [modelUrl]);

        const initScene = () => {
            if (!canvasRef.current || !containerRef.current) return;

            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;

            if (width === 0 || height === 0) return;

            if (rendererRef.current) {
                rendererRef.current.dispose();
                rendererRef.current = null;
            }

            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x1e293b);
            sceneRef.current = scene;

            const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 20);
            camera.position.set(0, 1, 2.5);
            camera.lookAt(0, 0.8, 0);
            cameraRef.current = camera;

            const renderer = new THREE.WebGLRenderer({
                canvas: canvasRef.current,
                antialias: true,
                alpha: true
            });

            renderer.setSize(width, height);
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            rendererRef.current = renderer;

            const light = new THREE.DirectionalLight(0xffffff, Math.PI);
            light.position.set(1, 1, 1).normalize();
            scene.add(light);

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            scene.add(ambientLight);

            const gridHelper = new THREE.GridHelper(10, 10, 0x3b82f6, 0x334155);
            gridHelper.position.y = 0;
            scene.add(gridHelper);

            const animate = () => {
                if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

                const delta = clockRef.current.getDelta();

                // 更新表情控制器
                if (expressionControllerRef.current) {
                    expressionControllerRef.current.update(delta);
                }

                // 更新 VRM
                if (vrmRef.current) {
                    if (autoRotate) {
                        rotationRef.current.y += 0.006;
                    }
                    vrmRef.current.scene.rotation.y = rotationRef.current.y;
                    vrmRef.current.update(delta);
                }

                // 更新相机（移除缩放功能）
                if (cameraRef.current && initialCameraDistanceRef.current) {
                    cameraRef.current.position.z = initialCameraDistanceRef.current;
                }

                rendererRef.current.render(sceneRef.current, cameraRef.current);
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

                if (!vrm || !sceneRef.current) {
                    throw new Error('Failed to load VRM');
                }

                VRMUtils.rotateVRM0(vrm);
                sceneRef.current.add(vrm.scene);
                vrmRef.current = vrm;

                // 初始化表情控制器
                expressionControllerRef.current = new ExpressionController(vrm, 0.5);

                // 计算边界盒并调整位置
                const box = new THREE.Box3().setFromObject(vrm.scene);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());

                vrm.scene.position.x = -center.x;
                vrm.scene.position.y = -box.min.y;
                vrm.scene.position.z = -center.z;

                const modelHeight = size.y;
                const distance = modelHeight * 1.5;
                initialCameraDistanceRef.current = distance;

                if (cameraRef.current) {
                    cameraRef.current.position.set(0, modelHeight * 0.5, distance);
                    cameraRef.current.lookAt(0, modelHeight * 0.5, 0);
                }

                setIsLoading(false);
            } catch (error) {
                console.error('Failed to load VRM:', error);
                setIsLoading(false);
            }
        };

        const cleanup = () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }

            if (expressionControllerRef.current) {
                expressionControllerRef.current.dispose();
                expressionControllerRef.current = null;
            }

            if (vrmRef.current) {
                VRMUtils.deepDispose(vrmRef.current.scene);
                vrmRef.current = null;
            }

            if (rendererRef.current) {
                rendererRef.current.dispose();
                rendererRef.current = null;
            }
        };

        return (
            <div ref={containerRef} className={className}>
                <canvas ref={canvasRef} />
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
                        <div className="text-white text-sm">加载中...</div>
                    </div>
                )}
            </div>
        );
    }
);

VRMPreviewWithExpression.displayName = 'VRMPreviewWithExpression';
