/**
 * VRM 元数据提取器
 * 
 * 轻量级工具，仅用于提取 VRM 文件的元数据（如表情列表）
 * 不创建渲染器、场景等重量级资源
 */
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { Logger } from './logger';

/**
 * VRM 元数据
 */
export interface VRMMetadata {
  availableExpressions: string[];
  modelName?: string;
  version?: string;
}

/**
 * 从 VRM 文件中提取元数据
 * @param file - VRM 文件对象
 * @returns VRM 元数据
 */
export async function extractVRMMetadata(file: File): Promise<VRMMetadata> {
  const url = URL.createObjectURL(file);
  
  try {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    Logger.debug('开始提取VRM元数据', { fileName: file.name });

    const gltf = await loader.loadAsync(url);
    const vrm = gltf.userData.vrm;

    if (!vrm) {
      throw new Error('文件不是有效的VRM模型');
    }

    // 提取表情列表
    const availableExpressions = vrm.expressionManager
      ? Object.keys(vrm.expressionManager.expressionMap)
      : [];

    // 提取模型名称
    const modelName = vrm.meta?.name || file.name;

    // 提取 VRM 版本
    const version = vrm.meta?.metaVersion || 'unknown';

    Logger.debug('VRM元数据提取成功', {
      expressionCount: availableExpressions.length,
      modelName,
      version
    });

    return {
      availableExpressions,
      modelName,
      version
    };
  } catch (error) {
    Logger.error('VRM元数据提取失败', error instanceof Error ? error : undefined);
    throw error;
  } finally {
    // 立即释放 URL
    URL.revokeObjectURL(url);
  }
}

/**
 * 仅提取表情列表（最轻量级）
 * @param file - VRM 文件对象
 * @returns 表情列表
 */
export async function extractExpressions(file: File): Promise<string[]> {
  const metadata = await extractVRMMetadata(file);
  return metadata.availableExpressions;
}
