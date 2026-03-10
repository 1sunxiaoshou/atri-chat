import { ContactShadows } from '@react-three/drei';
import { EffectComposer, DepthOfField, Bloom, Vignette } from '@react-three/postprocessing';
import { ReactNode, useState, useEffect } from 'react';
import { VRMRenderConfig } from '../../VRMRenderSettings';
import { GenshinControls } from '../core/GenshinControls';

interface AIStageProps {
    children: ReactNode;
    /** 渲染配置（可选，使用默认值） */
    config?: Partial<VRMRenderConfig>;
    /** 是否启用轨道控制（默认 true） */
    enableControls?: boolean;
    /** @deprecated 使用 config.environment 代替 */
    environment?: 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'studio' | 'city' | 'park' | 'lobby';
    /** @deprecated 使用 config.enablePostProcessing 代替 */
    enablePostProcessing?: boolean;
    /** @deprecated 使用 config.bloomIntensity 代替 */
    bloomIntensity?: number;
    /** @deprecated 使用 config.enableDepthOfField 代替 */
    depthOfFieldEnabled?: boolean;
}

/**
 * AI 沉浸式场景预设 - 用于聊天界面
 * 提供电影级环境光、接触阴影和后处理特效
 * 
 * 支持通过 config 参数动态配置所有渲染特性
 */
export function AIStage({
    children,
    config,
    enableControls = true,
    // 向后兼容的旧参数
    environment = 'apartment',
    enablePostProcessing = true,
    bloomIntensity = 0.5,
    depthOfFieldEnabled = true,
}: AIStageProps) {
    // 合并配置（优先使用 config，其次使用旧参数）
    const finalConfig = {
        environment: config?.environment ?? environment,
        showEnvironmentBackground: config?.showEnvironmentBackground ?? true,
        backgroundBlurriness: config?.backgroundBlurriness ?? 0.2,
        backgroundIntensity: config?.backgroundIntensity ?? 1.0,
        enableMainLight: config?.enableMainLight ?? true,
        mainLightIntensity: config?.mainLightIntensity ?? 1.5,
        enableAmbientLight: config?.enableAmbientLight ?? true,
        ambientLightIntensity: config?.ambientLightIntensity ?? 0.5,
        enableRimLight: config?.enableRimLight ?? true,
        rimLightIntensity: config?.rimLightIntensity ?? 0.3,
        enableShadows: config?.enableShadows ?? false,
        enableContactShadows: config?.enableContactShadows ?? true,
        enablePostProcessing: config?.enablePostProcessing ?? enablePostProcessing,
        enableBloom: config?.enableBloom ?? true,
        enableDepthOfField: config?.enableDepthOfField ?? depthOfFieldEnabled,
        enableVignette: config?.enableVignette ?? true,
        bloomIntensity: config?.bloomIntensity ?? bloomIntensity,
    };

    return (
        <>
            {/* 主光源 - 模拟自然光 */}
            {finalConfig.enableMainLight && (
                <directionalLight
                    position={[5, 5, 5]}
                    intensity={finalConfig.mainLightIntensity}
                    castShadow={finalConfig.enableShadows}
                />
            )}

            {/* 补光 - 减少阴影 */}
            {finalConfig.enableAmbientLight && (
                <ambientLight intensity={finalConfig.ambientLightIntensity} />
            )}

            {/* 边缘光 - 增加立体感 */}
            {finalConfig.enableRimLight && (
                <directionalLight
                    position={[-5, 3, -5]}
                    intensity={finalConfig.rimLightIntensity}
                />
            )}

            {/* 高质量接触阴影 */}
            {finalConfig.enableContactShadows && (
                <ContactShadows
                    position={[0, 0, 0]}
                    opacity={0.4}
                    scale={10}
                    blur={2.5}
                    far={4}
                    resolution={1024}
                    color="#000000"
                />
            )}

            {children}

            {/* 原神风格轨道控制器 - 360度自由旋转 + 地面碰撞 */}
            {enableControls && (
                <GenshinControls
                    target={[0, 0.9, 0]}
                    minDistance={0.8}       // 减小最小距离，允许更近的视角
                    maxDistance={5}
                    groundLevel={0.05}      // 地面高度，防止相机穿透地板
                    enableDamping
                    dampingFactor={0.05}
                    enablePan={false}
                />
            )}

            {/* 电影级后处理特效 */}
            {finalConfig.enablePostProcessing && (
                <EffectComposer>
                    <>
                        {finalConfig.enableDepthOfField && (
                            <DepthOfField
                                focusDistance={0}
                                focalLength={0.02}
                                bokehScale={2}
                                height={480}
                            />
                        )}
                        {finalConfig.enableBloom && (
                            <Bloom
                                luminanceThreshold={0.9}
                                intensity={finalConfig.bloomIntensity}
                                levels={8}
                                mipmapBlur
                            />
                        )}
                        {finalConfig.enableVignette && (
                            <Vignette
                                offset={0.3}
                                darkness={0.5}
                                eskil={false}
                            />
                        )}
                    </>
                </EffectComposer>
            )}
        </>
    );
}
