import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import {
    useVRMLoader,
    useLipSync,
    useAutoBlink,
    useAutoLookAt,
} from '@/components/vrm/hooks';
import { useMotionController } from '@/components/vrm/hooks/useMotionController';
import { useVRMStore } from '@/store/vrm/useVRMStore';

interface CharacterProps {
    /** VRM 模型 URL */
    url: string;
    /** 表情名称 (可选覆盖 Store) */
    expression?: string;
    /** 动作文件 URL (.vrma) (可选覆盖 Store) */
    motionUrl?: string | null;
    /** 音频元素（用于口型同步） */
    audioElement?: HTMLAudioElement | null;
    /** 是否启用口型同步 */
    enableLipSync?: boolean;
    /** 是否启用自动眨眼 (可选覆盖 Store) */
    enableBlink?: boolean;
    /** 视线跟随模式 (可选覆盖 Store) */
    lookAtMode?: 'mouse' | 'camera' | 'none';
    /** 是否循环播放动作 */
    loopMotion?: boolean;
    /** 动作播放完成回调（仅在非循环模式下触发） */
    onMotionComplete?: () => void;
    /** 模型加载完成回调，返回检测到的表情列表 */
    onModelLoaded?: (expressions: string[]) => void;
    /** 动作切换淡入淡出时间 */
    fadeDuration?: number;
}

/**
 * Character 核心模型组件
 * 整合所有 VRM 功能：加载、表情、动作、口型、眨眼、视线
 * 
 * 性能关键：所有高频更新在单一 useFrame 中完成，不触发 React 渲染
 */
export function Character({
    url,
    expression: propExpression,
    motionUrl: propMotionUrl,
    audioElement,
    enableLipSync = true,
    enableBlink: propEnableBlink,
    lookAtMode: propLookAtMode,
    loopMotion = true,
    onMotionComplete,
    onModelLoaded,
    fadeDuration = 0.3,
}: CharacterProps) {
    // 从 Store 获取配置和运行时状态
    const { enableBlink: storeEnableBlink, lookAtMode: storeLookAtMode } = useVRMStore((state) => state.config);
    const { expression: storeExpression, motionUrl: storeMotionUrl } = useVRMStore((state) => state.runtime);

    // 优先使用 Prop，其次使用 Store
    const expression = propExpression !== undefined ? propExpression : storeExpression;
    const motionUrl = propMotionUrl !== undefined ? propMotionUrl : storeMotionUrl;
    const enableBlink = propEnableBlink !== undefined ? propEnableBlink : storeEnableBlink;
    const lookAtMode = propLookAtMode !== undefined ? propLookAtMode : storeLookAtMode;
    // ...

    // 加载 VRM 模型
    const vrm = useVRMLoader(url);

    // 位置调整标记（避免重复调整）
    const hasAdjustedPosition = useRef(false);

    // 模型加载完成回调
    useEffect(() => {
        if (vrm && onModelLoaded) {
            // 提取模型自带的表情列表
            const expressionsFromVrm = vrm.expressionManager 
                ? Object.keys(vrm.expressionManager.expressionMap)
                : [];
            onModelLoaded(expressionsFromVrm);
        }
    }, [vrm, onModelLoaded]);

    // 模型加载后立即重置姿态（仅在没有动作时执行，避免覆盖初始动作）
    useEffect(() => {
        if (vrm && !motionUrl) {
            // 重置到 T-Pose
            vrm.humanoid?.resetNormalizedPose();
        }
    }, [vrm, motionUrl]);

    // 为当前模型创建唯一的 AnimationMixer
    const mixer = useMemo(() => {
        if (!vrm) return null;
        return new THREE.AnimationMixer(vrm.scene);
    }, [vrm]);

    // 清理旧的 Mixer (当 vrm 改变或组件卸载时)
    useEffect(() => {
        return () => {
            if (mixer) {
                mixer.stopAllAction();
                if (vrm?.scene) {
                    mixer.uncacheRoot(vrm.scene);
                }
            }
        };
    }, [mixer, vrm]);


    // 初始化各个功能模块
    const lipSyncRef = useLipSync(vrm, audioElement, enableLipSync && !!audioElement);
    const blinkRef = useAutoBlink(vrm, enableBlink);
    const motionController = useMotionController(vrm, mixer);
    const lookAtRef = useAutoLookAt(vrm, lookAtMode);

    // 注册动作完成回调
    useEffect(() => {
        if (onMotionComplete) {
            motionController.onFinished(() => {
                onMotionComplete();
            });
        }
    }, [motionController, onMotionComplete]);

    // 当 motionUrl 变化时，播放新动作
    useEffect(() => {
        if (motionUrl) {
            motionController.play(motionUrl, {
                loop: loopMotion,
                fadeDuration: fadeDuration,
            });
        } else if (motionUrl === null) {
            // 如果 motionUrl 明确为 null，重置模型姿态到 T-Pose
            if (vrm && mixer) {
                // 停止所有动作
                mixer.stopAllAction();
                // 重置 VRM 的姿态
                vrm.humanoid?.resetNormalizedPose();
            }
        }
    }, [motionUrl, loopMotion, motionController, vrm, fadeDuration, mixer]);

    // 模型位置自适应：居中 + 底部对齐地面 + 面向相机
    useEffect(() => {
        if (!vrm || hasAdjustedPosition.current) return;

        // 计算模型边界盒
        const box = new THREE.Box3().setFromObject(vrm.scene);
        const center = box.getCenter(new THREE.Vector3());

        // 调整位置
        // X 轴：居中
        vrm.scene.position.x = -center.x;
        // Y 轴：底部对齐地面（Y=0）
        vrm.scene.position.y = -box.min.y;
        // Z 轴：居中
        vrm.scene.position.z = -center.z;

        // 调整旋转：让模型面向相机（旋转 180°）
        // VRM 标准朝向是 +Z，相机在 +Z 看向原点，所以需要旋转 180°
        vrm.scene.rotation.y = Math.PI;

        hasAdjustedPosition.current = true;
    }, [vrm]);

    // 表情控制（通过 store 驱动）
    useEffect(() => {
        if (vrm && vrm.expressionManager && expression) {
            // 重置所有表情
            vrm.expressionManager.resetValues();
            // 设置新表情
            vrm.expressionManager.setValue(expression, 1.0);
        }
    }, [vrm, expression]);

    // 全局唯一高频更新循环
    useFrame((_state, delta) => {
        if (!vrm) return;

        // 1. 核心 VRM 更新（骨骼、物理、表情）
        vrm.update(delta);

        // 2. 附加效果更新（直接操作底层引用，不触发 React 渲染）
        motionController.update(delta);
        lipSyncRef.current?.update(delta);
        blinkRef.current?.update(delta);
        lookAtRef.current?.update(delta);
    });

    // 渲染 VRM 场景
    return vrm ? <primitive object={vrm.scene} /> : null;
}
