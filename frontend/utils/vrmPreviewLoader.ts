/**
 * VRM 预览加载器
 * 
 * 用于 Admin 页面的 VRM 模型预览，功能简化版
 * 只负责加载和显示模型，不包含动画播放等复杂功能
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils, VRM } from '@pixiv/three-vrm';
import { Logger } from './logger';

export class VRMPreviewLoader {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private clock: THREE.Clock;
  private currentVrm: VRM | null = null;
  private animationFrameId: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    // 初始化场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x212121);

    // 初始化相机
    const width = canvas.clientWidth || 512;
    const height = canvas.clientHeight || 512;
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 20);
    this.camera.position.set(0, 1.3, 1.0);

    // 初始化渲染器
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // 设置输出颜色空间
    if ('outputColorSpace' in this.renderer) {
      (this.renderer as any).outputColorSpace = 'srgb';
    } else {
      (this.renderer as any).outputEncoding = 3001;
    }

    // 初始化控制器
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 1.3, 0);
    this.controls.enableDamping = true;
    this.controls.enableZoom = true;
    this.controls.enablePan = false;

    // 初始化灯光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(1, 1, 1).normalize();
    this.scene.add(directionalLight);

    // 时钟
    this.clock = new THREE.Clock();

    // 开始渲染循环
    this.animate();

    Logger.debug('VRM预览加载器初始化完成');
  }

  /**
   * 加载 VRM 模型
   */
  async loadModel(url: string): Promise<VRM> {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    try {
      Logger.debug('开始加载VRM模型预览', { url });

      const gltf = await loader.loadAsync(url);
      const vrm = gltf.userData.vrm;

      if (!vrm) {
        throw new Error('文件不是有效的VRM模型');
      }

      // 优化VRM
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
      VRMUtils.rotateVRM0(vrm);

      // 移除旧模型
      if (this.currentVrm) {
        this.scene.remove(this.currentVrm.scene);
        VRMUtils.deepDispose(this.currentVrm.scene);
      }

      this.currentVrm = vrm;
      this.scene.add(vrm.scene);

      // 禁用视锥剔除和描边
      vrm.scene.traverse((obj: any) => {
        obj.frustumCulled = false;
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((mat: any) => {
            if (mat.isMToonMaterial) {
              mat.outlineWidthMode = 'none';
              mat.outlineWidthFactor = 0;
              mat.outlineLightingMixFactor = 0;
              mat.needsUpdate = true;
            }
            if (mat.outlineWidth !== undefined) {
              mat.outlineWidth = 0;
            }
          });
        }
      });

      Logger.debug('VRM模型预览加载成功');
      return vrm;
    } catch (error) {
      Logger.error('VRM模型预览加载失败', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * 渲染循环
   */
  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const deltaTime = this.clock.getDelta();

    if (this.currentVrm) {
      this.currentVrm.update(deltaTime);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  /**
   * 获取可用的表情列表
   */
  getAvailableExpressions(): string[] {
    if (!this.currentVrm?.expressionManager) {
      return [];
    }
    return Object.keys(this.currentVrm.expressionManager.expressionMap);
  }

  /**
   * 销毁资源
   */
  dispose(): void {
    Logger.debug('销毁VRM预览加载器');

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.scene.clear();
    this.renderer.dispose();

    if (this.currentVrm) {
      VRMUtils.deepDispose(this.currentVrm.scene);
    }
  }
}
