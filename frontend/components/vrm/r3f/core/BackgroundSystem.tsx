import { useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { useEffect } from 'react';
import * as THREE from 'three';

/**
 * 增强型背景系统
 * 使用 Canvas 纹理实现 2D 图片的比例自适应 (Object-fit: cover)
 * 解决原生 scene.background 拉伸变形的问题
 */
export function BackgroundSystem({ url }: { url: string }) {
    const { scene, size } = useThree();
    const texture = useTexture(url);

    useEffect(() => {
        if (texture && texture.image instanceof HTMLImageElement) {
            const img = texture.image;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // 设置 Canvas 尺寸为当前屏幕尺寸，乘以像素比以保证清晰度
            const dpr = window.devicePixelRatio || 1;
            canvas.width = size.width * dpr;
            canvas.height = size.height * dpr;

            // 计算 Cover 比例
            const imgW = img.naturalWidth || img.width;
            const imgH = img.naturalHeight || img.height;
            const imgAspect = imgW / imgH;
            const canvasAspect = canvas.width / canvas.height;

            let drawW, drawH, drawX, drawY;

            if (imgAspect > canvasAspect) {
                // 图片更宽，以高度为基准缩放
                drawH = canvas.height;
                drawW = drawH * imgAspect;
                drawX = (canvas.width - drawW) / 2;
                drawY = 0;
            } else {
                // 画布更宽，以宽度为基准缩放
                drawW = canvas.width;
                drawH = drawW / imgAspect;
                drawX = 0;
                drawY = (canvas.height - drawH) / 2;
            }

            // 绘制
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, drawX, drawY, drawW, drawH);

            // 创建原生背景纹理
            const bgTexture = new THREE.CanvasTexture(canvas);
            bgTexture.colorSpace = THREE.SRGBColorSpace;
            
            // 应用到场景
            scene.background = bgTexture;
            
            // 确保没有残留的模糊效果
            if ('backgroundBlurriness' in scene) {
                (scene as any).backgroundBlurriness = 0;
            }

            return () => {
                bgTexture.dispose();
            };
        }
        return undefined;
    }, [texture, scene, size.width, size.height]);

    return null;
}
