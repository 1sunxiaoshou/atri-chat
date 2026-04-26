import { useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useVRMStore } from '@/store/vrm/useVRMStore';

interface GenshinControlsProps {
    /** 相机注视点 */
    target?: [number, number, number];
    /** 最小距离 */
    minDistance?: number;
    /** 最大距离 */
    maxDistance?: number;
    /** 地面高度（相机不会低于此高度） */
    groundLevel?: number;
    /** 是否启用阻尼 */
    enableDamping?: boolean;
    /** 阻尼系数 */
    dampingFactor?: number;
    /** 是否启用平移 */
    enablePan?: boolean;
}

/**
 * 原神风格的相机控制器
 * 
 * 特点：
 * - 360度自由旋转（上下左右无限制）
 * - 智能碰撞检测（碰到地面时自动拉近距离，避免穿透）
 * - 平滑的阻尼效果
 */
export function GenshinControls({
    target = [0, 0.9, 0],
    minDistance = 1.5,
    maxDistance = 5,
    groundLevel = 0.1,
    enableDamping = true,
    dampingFactor = 0.05,
    enablePan = false,
}: GenshinControlsProps) {
    const { camera } = useThree();
    const controlsRef = useRef<any>(null);
    const targetVector = useRef(new THREE.Vector3(...target));
    const desiredPositionRef = useRef<THREE.Vector3 | null>(null);
    const desiredTargetRef = useRef<THREE.Vector3 | null>(null);
    const cameraPreset = useVRMStore((state) => state.runtime.cameraPreset);
    const cameraAction = useVRMStore((state) => state.runtime.cameraAction);
    const cameraDurationMs = useVRMStore((state) => state.runtime.cameraDurationMs);

    const getPresetState = (preset: string | null) => {
        switch (preset) {
        case 'close':
            return {
                position: new THREE.Vector3(0, 1.15, 1.35),
                target: new THREE.Vector3(0, 1.05, 0),
            };
        case 'upper':
            return {
                position: new THREE.Vector3(0, 1.45, 1.9),
                target: new THREE.Vector3(0, 1.15, 0),
            };
        case 'front':
        default:
            return {
                position: new THREE.Vector3(0, 0.9, 2.2),
                target: new THREE.Vector3(...target),
            };
        }
    };

    useFrame((_, delta) => {
        if (cameraPreset) {
            const presetState = getPresetState(cameraPreset);
            desiredPositionRef.current = presetState.position;
            desiredTargetRef.current = presetState.target;
        }

        if (desiredPositionRef.current && desiredTargetRef.current) {
            const smoothing = cameraAction === 'cut'
                ? 1
                : Math.min(1, delta / Math.max((cameraDurationMs ?? 600) / 1000, 0.001));

            camera.position.lerp(desiredPositionRef.current, smoothing);
            if (controlsRef.current) {
                controlsRef.current.target.lerp(desiredTargetRef.current, smoothing);
                controlsRef.current.update();
            }

            if (
                camera.position.distanceTo(desiredPositionRef.current) < 0.01 &&
                controlsRef.current?.target?.distanceTo?.(desiredTargetRef.current) < 0.01
            ) {
                desiredPositionRef.current = null;
                desiredTargetRef.current = null;
            }
        }
    });

    // 每帧检查地面碰撞并调整距离
    useFrame(() => {
        if (!controlsRef.current) {return;}

        // 更新目标点
        targetVector.current.set(...target);

        // 计算从目标点到相机的方向和距离
        const cameraToTarget = new THREE.Vector3()
            .subVectors(camera.position, targetVector.current);

        const currentDistance = cameraToTarget.length();
        const direction = cameraToTarget.normalize();

        // 计算相机在当前方向上能到达的最远距离（不穿透地面）
        let maxAllowedDistance = currentDistance;

        // 如果相机方向向下（direction.y < 0），计算与地面的交点
        if (direction.y < 0) {
            // 计算射线与地面平面的交点距离
            // 地面方程：y = groundLevel
            // 射线方程：P = target + t * direction
            // 求解：target.y + t * direction.y = groundLevel
            const t = (groundLevel - targetVector.current.y) / direction.y;

            if (t > 0) {
                // 交点存在，限制最大距离（留5%缓冲）
                // 但不能小于 minDistance
                maxAllowedDistance = Math.max(
                    minDistance,
                    Math.min(currentDistance, t * 0.95)
                );
            }
        }

        // 如果当前距离超过允许距离，拉近相机
        if (currentDistance > maxAllowedDistance && maxAllowedDistance >= minDistance) {
            const newPosition = new THREE.Vector3()
                .copy(targetVector.current)
                .add(direction.multiplyScalar(maxAllowedDistance));

            // 平滑过渡
            camera.position.lerp(newPosition, 0.2);
        }

        // 最后的安全检查：确保相机不会低于地面
        if (camera.position.y < groundLevel) {
            camera.position.y = groundLevel;
        }
    });

    return (
        <OrbitControls
            ref={controlsRef}
            target={target}
            minDistance={minDistance}
            maxDistance={maxDistance}
            enableDamping={enableDamping}
            dampingFactor={dampingFactor}
            enablePan={enablePan}
        // 完全无限制旋转（删除角度限制）
        // minPolarAngle 和 maxPolarAngle 不设置 = 无限制
        />
    );
}
