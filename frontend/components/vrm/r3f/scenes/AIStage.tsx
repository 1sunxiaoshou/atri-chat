import { ContactShadows } from '@react-three/drei';
import { EffectComposer, DepthOfField, Bloom, Vignette } from '@react-three/postprocessing';
import { ReactNode, Suspense } from 'react';
import { useVRMStore } from '../../../../store/vrm/useVRMStore';
import { GenshinControls } from '../core/GenshinControls';
import { BackgroundSystem } from '../core/BackgroundSystem';

interface AIStageProps {
    children: ReactNode;
    /** 是否启用轨道控制（默认 true） */
    enableControls?: boolean;
    /** 是否启用背景系统（默认 true） */
    showBackground?: boolean;
}

/**
 * AI 沉浸式场景预设 - 用于聊天界面
 * 提供电影级环境光、接触阴影和后处理特效
 * 
 * 现在通过 useVRMStore 自动同步所有渲染配置
 */
export function AIStage({
    children,
    enableControls = true,
    showBackground = true,
}: AIStageProps) {
    // 从 Store 获取全局配置
    const finalConfig = useVRMStore((state) => state.config);

    return (
        <>
            {/* 主光源 - 侧前方 */}
            <directionalLight
                position={[3, 5, 4]}
                intensity={finalConfig.mainLightIntensity}
                castShadow={finalConfig.enableShadows}
            />

            {/* 环境半球光 - 天空与地面漫反射 */}
            <hemisphereLight 
                intensity={finalConfig.ambientLightIntensity} 
                color="#ffffff" 
                groundColor="#444444" 
            />

            {/* 边缘光/补光 - 增加轮廓感 */}
            <directionalLight
                position={[-3, 2, -2]}
                intensity={finalConfig.rimLightIntensity}
            />






            {/* 高质量接触阴影 - 进一步微调以避免显眼的“地板”边缘 */}
            {finalConfig.enableContactShadows && (
                <ContactShadows
                    position={[0, -0.01, 0]} // 稍微下移，避免 Z-fighting
                    opacity={0.4}
                    scale={10}
                    blur={2.5}
                    far={2} // 减小 far 值，使阴影只在接触点附近产生
                    resolution={1024}
                    color="#000000"
                    frames={1}
                />
            )}

            {/* 环境光照已彻底移除，改由全局光照倍数控制明亮度 */}

            {/* 2. 背景贴图系统 - 始终渲染以处理可能的背景清理 */}

            <Suspense fallback={null}>
                <BackgroundSystem
                    url={showBackground && finalConfig.backgroundImage && finalConfig.backgroundImage !== 'none'
                        ? `/BG/${finalConfig.backgroundImage}`
                        : 'none'}
                />
            </Suspense>

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
                <EffectComposer multisampling={4}>
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
