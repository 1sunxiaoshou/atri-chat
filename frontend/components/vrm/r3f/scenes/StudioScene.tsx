import { Grid, OrbitControls, PerspectiveCamera, Bounds } from '@react-three/drei';
import { ReactNode } from 'react';

interface StudioSceneProps {
    children: ReactNode;
    showGrid?: boolean;
    enableControls?: boolean;
    intensity?: number;
    /** 是否启用相机自适应（默认 true） */
    enableCameraFit?: boolean;
    /** 是否启用自动旋转（默认 false） */
    autoRotate?: boolean;
    /** 自动旋转速度（默认 2.0） */
    autoRotateSpeed?: number;
}

/**
 * 工作室场景预设 - 用于后台管理界面
 * 提供简洁的光照和轨道控制
 * 
 * 配置参考旧版 VRMMotionPreviewOptimized 组件：
 * - 相机位置: [0, 1, 2.5]
 * - FOV: 40
 * - 光照: DirectionalLight + AmbientLight
 * - 目标点: [0, 0.8, 0]
 * 
 * 新增功能：
 * - 相机自适应：自动调整相机距离以适应不同大小的模型
 */
export function StudioScene({
    children,
    showGrid = true,
    enableControls = true,
    intensity = 1,
    enableCameraFit = true,
    autoRotate = false,
    autoRotateSpeed = 2.0,
}: StudioSceneProps) {


    return (
        <>
            {/* 相机设置 - 与旧组件一致 */}
            <PerspectiveCamera
                makeDefault
                position={[0, 1, 2.5]}
                fov={40}
                near={0.1}
                far={20}
            />

            {/* 角色预览场景不启用自定义背景 */}


            {/* 主光源 - 与旧组件一致 */}
            <directionalLight
                position={[1, 1, 1]}
                intensity={Math.PI * intensity}
            />

            {/* 环境光 - 与旧组件一致 */}
            <ambientLight intensity={0.6 * intensity} />

            {/* 相机自适应包裹器 */}
            {enableCameraFit ? (
                <Bounds
                    fit
                    clip
                    margin={1.2}
                >
                    {children}
                </Bounds>
            ) : (
                children
            )}

            {/* 无限网格底盘 - 极淡的颜色 */}
            {showGrid && (
                <Grid
                    args={[10, 10]}
                    cellSize={1}
                    cellThickness={0.5}
                    cellColor="#e2e8f0"
                    sectionSize={1}
                    sectionThickness={1}
                    sectionColor="#f1f5f9"
                    fadeDistance={25}
                    fadeStrength={1}
                    followCamera={false}
                    infiniteGrid
                    position={[0, 0, 0]}
                />
            )}

            {/* 轨道控制器 - 与旧组件交互逻辑一致 */}
            {enableControls && (
                <OrbitControls
                    makeDefault
                    target={[0, 0.8, 0]}
                    minDistance={1}
                    maxDistance={10}
                    enablePan={false}
                    enableDamping
                    dampingFactor={0.05}
                    autoRotate={autoRotate}
                    autoRotateSpeed={autoRotateSpeed}
                />
            )}
        </>
    );
}
