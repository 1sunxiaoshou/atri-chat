import { Canvas } from '@react-three/fiber';
import { ReactNode } from 'react';
import * as THREE from 'three';

interface VRMCanvasProps {
    children: ReactNode;
    shadows?: boolean;
    camera?: {
        position?: [number, number, number];
        fov?: number;
    };
    className?: string;
    /** 是否启用透明背景（默认 false） */
    transparent?: boolean;
}

/**
 * VRM 渲染容器 - R3F Canvas 统一配置
 * 提供标准的 Three.js 渲染上下文
 */
export function VRMCanvas({
    children,
    shadows = true,
    camera = { position: [0, 1.5, 3], fov: 50 },
    className = 'w-full h-full',
    transparent = false,
}: VRMCanvasProps) {
    return (
        <Canvas
            shadows={shadows}
            camera={camera}
            gl={{
                antialias: true,
                alpha: transparent,
                stencil: false,
                depth: true,
                preserveDrawingBuffer: true,
                failIfMajorPerformanceCaveat: false,
                powerPreference: 'high-performance',
                // 解决模型“变透明”的关键：确保色调映射正确
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 1.0,
            }}
            onCreated={({ gl }) => {
                // 1. 禁用自动重置
                gl.info.autoReset = false;


                // 2. 静默处理 WebGL 上下文丢失
                gl.domElement.addEventListener('webglcontextlost', (event) => {
                    event.preventDefault();
                });

                gl.domElement.addEventListener('webglcontextrestored', () => {
                    gl.resetState();
                });
            }}
            className={className}
        >
            {children}
        </Canvas>
    );
}
