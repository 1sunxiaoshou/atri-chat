import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { useLanguage } from '../../../contexts/LanguageContext';

interface VRMThumbnailGeneratorProps {
    file: File;
    onThumbnailGenerated: (blob: Blob) => void;
    onExpressionsExtracted?: (expressions: string[]) => void;
    onError?: (error: string) => void;
}

/**
 * 隐藏的VRM缩略图生成器组件
 * 在后台渲染VRM模型并生成缩略图
 */
export const VRMThumbnailGenerator: React.FC<VRMThumbnailGeneratorProps> = ({
    file,
    onThumbnailGenerated,
    onExpressionsExtracted,
    onError
}) => {
    const { t } = useLanguage();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        generateThumbnail();
    }, [file]);

    const generateThumbnail = async () => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const width = 512;
        const height = 683; // 3:4 ratio (512 * 4/3)

        try {
            // 创建场景
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x1e293b);

            // 创建相机 - 3:4 aspect ratio
            const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 20);
            camera.position.set(0, 1, 2.5);
            camera.lookAt(0, 0.8, 0);

            // 创建渲染器
            const renderer = new THREE.WebGLRenderer({
                canvas,
                antialias: true,
                preserveDrawingBuffer: true // 重要：允许读取画布内容
            });
            renderer.setSize(width, height);
            renderer.outputColorSpace = THREE.SRGBColorSpace;

            // 添加光源
            const light = new THREE.DirectionalLight(0xffffff, Math.PI);
            light.position.set(1, 1, 1).normalize();
            scene.add(light);

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            scene.add(ambientLight);

            // 加载VRM模型
            const arrayBuffer = await file.arrayBuffer();
            const blob = new Blob([arrayBuffer]);
            const url = URL.createObjectURL(blob);

            const loader = new GLTFLoader();
            loader.register((parser) => new VRMLoaderPlugin(parser));

            const gltf = await loader.loadAsync(url);
            const vrm = gltf.userData.vrm as VRM;

            if (!vrm) {
                throw new Error(t('admin.loadDataFailed'));
            }

            // 提取表情列表
            if (onExpressionsExtracted && vrm.expressionManager) {
                const expressions = Object.keys(vrm.expressionManager.expressionMap);
                console.log('提取到的表情列表:', expressions);
                onExpressionsExtracted(expressions);
            }

            // 添加模型到场景
            VRMUtils.rotateVRM0(vrm);
            scene.add(vrm.scene);

            // 计算边界盒并调整位置
            const box = new THREE.Box3().setFromObject(vrm.scene);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // 将模型底部放在地面
            vrm.scene.position.x = -center.x;
            vrm.scene.position.y = -box.min.y;
            vrm.scene.position.z = -center.z;

            // 调整相机以适应模型 
            const modelHeight = size.y;
            const distance = modelHeight * 1.7;
            camera.position.set(0, modelHeight * 0.5, distance);
            camera.lookAt(0, modelHeight * 0.5, 0);

            // 渲染场景
            renderer.render(scene, camera);

            // 等待一帧确保渲染完成
            await new Promise(resolve => requestAnimationFrame(resolve));

            // 将画布转换为Blob
            canvas.toBlob((blob) => {
                if (blob) {
                    onThumbnailGenerated(blob);
                } else {
                    onError?.(t('admin.loadDataFailed'));
                }

                // 清理资源
                URL.revokeObjectURL(url);
                VRMUtils.deepDispose(vrm.scene);
                renderer.dispose();
            }, 'image/jpeg', 0.9);

        } catch (err) {
            console.error(t('admin.loadDataFailed'), err);
            onError?.(err instanceof Error ? err.message : t('admin.loadDataFailed'));
        }
    };

    // 隐藏的画布，用于后台渲染
    return (
        <canvas
            ref={canvasRef}
            width={512}
            height={683}
            style={{ display: 'none' }}
        />
    );
};
