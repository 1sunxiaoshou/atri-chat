import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { VRMRenderConfig, DEFAULT_VRM_RENDER_CONFIG } from '../../types/vrm';

/**
 * VRM 运行时状态（非持久化）
 */
interface VRMRuntimeState {
    modelUrl: string | null;
    expression: string;
    motionUrl: string | null;
    subtitle: string;
    cameraPreset: string | null;
    cameraAction: string | null;
    cameraDurationMs: number | null;
    isLoading: boolean;
    error: string | null;
}

/**
 * VRM Store 接口
 */
interface VRMStore {
    // 渲染配置 (持久化)
    config: VRMRenderConfig;
    setRenderConfig: (updates: Partial<VRMRenderConfig>) => void;
    resetRenderConfig: () => void;

    // 运行时状态 (不持久化)
    runtime: VRMRuntimeState;
    setRuntime: (updates: Partial<VRMRuntimeState>) => void;
    
    // 动作控制快捷方法
    setMotion: (url: string | null) => void;
    setExpression: (expression: string) => void;
    setSubtitle: (text: string) => void;
}

/**
 * VRM 状态管理仓库
 * 结合配置持久化与实时状态管理
 */
export const useVRMStore = create<VRMStore>()(
    persist(
        (set) => ({
            // 1. 渲染配置
            config: DEFAULT_VRM_RENDER_CONFIG,
            
            setRenderConfig: (updates) => set((state) => ({
                config: { ...state.config, ...updates }
            })),
            
            resetRenderConfig: () => set({
                config: DEFAULT_VRM_RENDER_CONFIG
            }),


            // 2. 运行时状态
            runtime: {
                modelUrl: null,
                expression: 'neutral',
                motionUrl: null,
                subtitle: '',
                cameraPreset: null,
                cameraAction: null,
                cameraDurationMs: null,
                isLoading: false,
                error: null,
            },

            setRuntime: (updates) => set((state) => ({
                runtime: { ...state.runtime, ...updates }
            })),

            // 3. 快捷 Action
            setMotion: (url) => set((state) => ({
                runtime: { ...state.runtime, motionUrl: url }
            })),

            setExpression: (expression) => set((state) => ({
                runtime: { ...state.runtime, expression }
            })),

            setSubtitle: (text) => set((state) => ({
                runtime: { ...state.runtime, subtitle: text }
            })),
        }),
        {
            name: 'vrm-settings',
            // 仅持久化 config 字段
            partialize: (state) => ({
                config: state.config,
            }),
        }
    )
);
