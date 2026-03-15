import { useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { useEffect } from 'react';
import * as THREE from 'three';

/**
 * 内部纹理应用组件
 * 仅在 URL 有效时渲染
 */
function BackgroundTextureItem({ url }: { url: string }) {
    const { scene, size } = useThree();
    const texture = useTexture(url);

    useEffect(() => {
        if (texture && texture.image instanceof HTMLImageElement) {
            const img = texture.image;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const dpr = window.devicePixelRatio || 1;
            canvas.width = size.width * dpr;
            canvas.height = size.height * dpr;

            const imgW = img.naturalWidth || img.width;
            const imgH = img.naturalHeight || img.height;
            const imgAspect = imgW / imgH;
            const canvasAspect = canvas.width / canvas.height;

            let drawW, drawH, drawX, drawY;
            if (imgAspect > canvasAspect) {
                drawH = canvas.height;
                drawW = drawH * imgAspect;
                drawX = (canvas.width - drawW) / 2;
                drawY = 0;
            } else {
                drawW = canvas.width;
                drawH = drawW / imgAspect;
                drawX = 0;
                drawY = (canvas.height - drawH) / 2;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, drawX, drawY, drawW, drawH);

            const bgTexture = new THREE.CanvasTexture(canvas);
            bgTexture.colorSpace = THREE.SRGBColorSpace;
            
            scene.background = bgTexture;
            
            if ('backgroundBlurriness' in scene) {
                (scene as any).backgroundBlurriness = 0;
            }

            return () => {
                bgTexture.dispose();
            };
        }
    }, [texture, scene, size.width, size.height]);

    return null;
}

/**
 * 增强型背景系统
 * 处理 'none' 状态并协调纹理加载
 */
export function BackgroundSystem({ url }: { url: string }) {
    const { scene } = useThree();

    // 当 URL 变为 'none' 时，立即清理背景
    useEffect(() => {
        if (url === 'none') {
            scene.background = null;
        }
    }, [url, scene]);

    // 如果是 'none'，不渲染加载纹理的组件
    if (url === 'none') {
        return null;
    }

    return <BackgroundTextureItem url={url} />;
}

