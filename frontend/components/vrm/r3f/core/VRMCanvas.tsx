import { Canvas } from '@react-three/fiber';
import { ReactNode } from 'react';

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
}: VRMCanvasProps) {
    return (
        <Canvas
            shadows={shadows}
            camera={camera}
            gl={{
                antialias: true,
                alpha: true,
                stencil: false,
                depth: true,
                failIfMajorPerformanceCaveat: false,
                powerPreference: 'high-performance',
            }}
            onCreated={({ gl }) => {
                // 1. 禁用自动重置，以便我们可以在 useFrame 中读取到完整的上一帧统计信息
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
