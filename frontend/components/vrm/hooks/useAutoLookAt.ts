import { VRM } from '@pixiv/three-vrm';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface LookAtController {
    update: (delta: number) => void;
    setTarget: (x: number, y: number, z: number) => void;
    followMouse: (enabled: boolean) => void;
    followCamera: (enabled: boolean) => void;
}

/**
 * 视线跟随 Hook
 * 实现视线跟随鼠标或摄像机
 * 
 * @param vrm - VRM 实例
 * @param mode - 跟随模式：'mouse' | 'camera' | 'none'
 * @returns 控制器引用
 */
export function useAutoLookAt(
    vrm: VRM | null,
    mode: 'mouse' | 'camera' | 'none' = 'mouse'
) {
    const controllerRef = useRef<LookAtController | null>(null);
    const currentModeRef = useRef(mode);
    const mousePositionRef = useRef({ x: 0, y: 0 });
    const targetPositionRef = useRef({ x: 0, y: 1.5, z: 1 });
    const currentPositionRef = useRef({ x: 0, y: 1.5, z: 1 });
    const previousModeRef = useRef(mode);
    const customTargetRef = useRef<THREE.Object3D | null>(null);

    const { camera, gl } = useThree();

    useEffect(() => {
        if (!vrm || !vrm.lookAt) {
            controllerRef.current = null;
            return;
        }

        currentModeRef.current = mode;

        // 创建自定义 target（用于鼠标模式和默认模式）
        if (!customTargetRef.current) {
            customTargetRef.current = new THREE.Object3D();
        }

        // 根据模式设置 target
        if (mode === 'camera') {
            // 相机模式：直接使用相机作为 target（官方推荐方式）
            vrm.lookAt.target = camera;
        } else {
            // 其他模式：使用自定义 target
            vrm.lookAt.target = customTargetRef.current;
        }

        // 鼠标移动监听
        const handleMouseMove = (event: MouseEvent) => {
            if (currentModeRef.current !== 'mouse') return;

            // 直接使用事件的 clientX/Y 和窗口尺寸，避免频繁调用 getBoundingClientRect
            const canvas = gl.domElement;
            const rect = canvas.getBoundingClientRect();

            // 将鼠标坐标转换为 [-1, 1] 范围
            mousePositionRef.current = {
                x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
                y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
            };
        };

        window.addEventListener('mousemove', handleMouseMove);

        controllerRef.current = {
            update: (delta: number) => {
                if (!vrm.lookAt) return;

                const mode = currentModeRef.current;

                // 检测模式切换
                if (previousModeRef.current !== mode) {
                    if (mode === 'camera') {
                        // 切换到相机模式：使用相机作为 target
                        vrm.lookAt.target = camera;
                    } else {
                        // 切换到其他模式：使用自定义 target
                        vrm.lookAt.target = customTargetRef.current;
                    }
                    currentPositionRef.current = { ...targetPositionRef.current };
                    previousModeRef.current = mode;
                }

                // 相机模式：VRM 会自动跟随 camera，无需手动更新位置
                if (mode === 'camera') {
                    return;
                }

                // 计算目标位置（鼠标模式或默认模式）
                if (mode === 'mouse') {
                    // 跟随鼠标
                    const { x, y } = mousePositionRef.current;

                    // 模型已旋转 180° 面向相机（-Z 方向）
                    // target 应该在模型前方（+Z 方向）
                    targetPositionRef.current = {
                        x: x * 2,           // X 轴正常映射（不反转）
                        y: y * 2 + 1.5,     // 调整高度到头部位置
                        z: 1                // 在模型前方（+Z）
                    };
                } else {
                    // 默认看向前方（相机方向）
                    targetPositionRef.current = {
                        x: 0,
                        y: 1.5,
                        z: 1                // 在模型前方（+Z）
                    };
                }

                // 平滑插值（lerp）到目标位置
                const lerpFactor = Math.min(delta * 5, 1);
                currentPositionRef.current.x += (targetPositionRef.current.x - currentPositionRef.current.x) * lerpFactor;
                currentPositionRef.current.y += (targetPositionRef.current.y - currentPositionRef.current.y) * lerpFactor;
                currentPositionRef.current.z += (targetPositionRef.current.z - currentPositionRef.current.z) * lerpFactor;

                // 应用平滑后的位置到自定义 target
                if (customTargetRef.current) {
                    customTargetRef.current.position.set(
                        currentPositionRef.current.x,
                        currentPositionRef.current.y,
                        currentPositionRef.current.z
                    );
                }
            },

            setTarget: (x: number, y: number, z: number) => {
                if (customTargetRef.current) {
                    customTargetRef.current.position.set(x, y, z);
                    // 同步更新当前位置和目标位置
                    currentPositionRef.current = { x, y, z };
                    targetPositionRef.current = { x, y, z };
                }
                if (vrm.lookAt) {
                    vrm.lookAt.target = customTargetRef.current;
                }
                currentModeRef.current = 'none';
            },

            followMouse: (enabled: boolean) => {
                currentModeRef.current = enabled ? 'mouse' : 'none';
                if (vrm.lookAt) {
                    vrm.lookAt.target = enabled ? customTargetRef.current : customTargetRef.current;
                }
            },

            followCamera: (enabled: boolean) => {
                currentModeRef.current = enabled ? 'camera' : 'none';
                if (vrm.lookAt) {
                    vrm.lookAt.target = enabled ? camera : customTargetRef.current;
                }
            },
        };

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            // 重置 lookAt target
            if (vrm.lookAt && customTargetRef.current) {
                customTargetRef.current.position.set(0, 1.5, 1);
                vrm.lookAt.target = customTargetRef.current;
            }
        };
    }, [vrm, mode, camera, gl]);

    return controllerRef;
}
