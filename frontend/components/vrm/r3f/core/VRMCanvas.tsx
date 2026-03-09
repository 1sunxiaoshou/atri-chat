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
    transparent = false,
}: VRMCanvasProps) {
    return (
        <Canvas
            shadows={shadows}
            camera={camera}
            gl={{
                antialias: true,
                alpha: transparent,
                preserveDrawingBuffer: true,
                failIfMajorPerformanceCaveat: false,
                powerPreference: 'high-performance',
            }}
            onCreated={({ gl }) => {
                // 静默处理 WebGL 上下文丢失（避免控制台警告）
                gl.domElement.addEventListener('webglcontextlost', (event) => {
                    event.preventDefault();
                    // 移除警告日志，这是正常的清理行为
                });

                gl.domElement.addEventListener('webglcontextrestored', () => {
                    // 强制重新渲染
                    gl.resetState();
                });
            }}
            className={className}
        >
            {children}
        </Canvas>
    );
}
