import { useGLTF } from '@react-three/drei';
import { VRMLoaderPlugin, VRMUtils, VRM } from '@pixiv/three-vrm';
import { useEffect } from 'react';
import { GLTFLoader } from 'three-stdlib';
import * as THREE from 'three';

/**
 * VRM 模型加载 Hook
 * 基于 useGLTF 实现自动缓存和 Suspense
 * 
 * ⚠️ 性能注意事项：
 * - useGLTF 会自动缓存模型，避免重复加载
 * - 组件卸载时会自动清理资源
 * - 建议使用 preload 预加载常用模型
 * 
 * @param url - VRM 模型文件 URL
 * @returns VRM 实例
 */
export function useVRMLoader(url: string): VRM | null {
    const gltf = useGLTF(url, true, true, (loader: GLTFLoader) => {
        // 局部类型断言：只对 register 调用使用 any，限制类型断言范围
        // three-stdlib 和 @types/three 的 GLTFParser 类型定义不兼容，但运行时完全兼容
        (loader.register as any)((parser: any) => new VRMLoaderPlugin(parser));
    });

    useEffect(() => {
        if (gltf.userData.vrm) {
            const vrm = gltf.userData.vrm as VRM;

            // 处理 VRM0.x 兼容性
            VRMUtils.rotateVRM0(vrm);

            // 移除不必要的顶点以优化性能
            VRMUtils.removeUnnecessaryVertices(vrm.scene);

            // 禁用视锥剔除，确保模型始终渲染
            vrm.scene.traverse((obj) => {
                obj.frustumCulled = false;
            });

            // 初始化 lookAt 目标（如果 lookAt 存在）
            if (vrm.lookAt && !vrm.lookAt.target) {
                vrm.lookAt.target = new THREE.Object3D();
                vrm.scene.add(vrm.lookAt.target);
            }
        }

        // 清理函数：组件卸载时释放资源
        return () => {
            if (gltf.userData.vrm) {
                const vrm = gltf.userData.vrm as VRM;

                // 使用 VRMUtils.deepDispose 清理 VRM 场景
                // 这会正确清理几何体、材质、纹理等所有资源
                if (vrm.scene) {
                    VRMUtils.deepDispose(vrm.scene);
                }
            }
        };
    }, [gltf]);

    return gltf.userData.vrm || null;
}

// 预加载函数
useVRMLoader.preload = (url: string) => {
    // 局部类型断言：useGLTF.preload 的 loader 回调类型不兼容
    (useGLTF.preload as any)(url, (loader: any) => {
        (loader.register as any)((parser: any) => new VRMLoaderPlugin(parser));
    });
};

// 清理缓存函数（用于手动清理不再使用的模型）
useVRMLoader.clear = (url: string) => {
    useGLTF.clear(url);
};

/**
 * 获取 VRM 模型缓存统计信息
 * 注意：useGLTF 内部缓存无法直接访问，这里返回估算值
 */
export function getVRMCacheStats() {
    // useGLTF 的缓存是内部的，无法直接访问
    // 这里返回一个占位值，实际使用时需要通过其他方式追踪
    return {
        size: 0, // 无法获取准确值
        estimatedMemory: 0,
    };
}
