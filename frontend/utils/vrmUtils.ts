/**
 * VRM 工具函数
 * 
 * 提供一些独立的 VRM 相关工具函数，用于非核心播放场景
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMAnimationLoaderPlugin } from '@pixiv/three-vrm-animation';
import { Logger } from './logger';

/**
 * 获取动画文件的时长
 * @param file - 动画文件（.vrma）
 * @returns 动画时长（秒）
 */
export async function getAnimationDuration(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  const loader = new GLTFLoader();
  
  // 注册 VRMA 插件
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

  try {
    const gltf = await loader.loadAsync(url);

    // 检查 VRM 动画
    const vrmAnimations = gltf.userData.vrmAnimations;
    if (vrmAnimations && vrmAnimations.length > 0) {
      return vrmAnimations[0].duration;
    }

    // 检查标准 glTF 动画
    if (gltf.animations && gltf.animations.length > 0) {
      const firstAnimation = gltf.animations[0];
      return firstAnimation ? firstAnimation.duration : 0;
    }

    return 0;
  } catch (error) {
    Logger.error('解析动画时长失败', error instanceof Error ? error : undefined);
    return 0;
  } finally {
    URL.revokeObjectURL(url);
  }
}
