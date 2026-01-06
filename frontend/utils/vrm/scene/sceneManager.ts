/**
 * SceneManager - 场景渲染管理器
 * 
 * 职责：
 * 1. Three.js 场景初始化（场景、相机、渲染器、灯光）
 * 2. 渲染循环控制
 * 3. 窗口大小适配
 * 4. 提供更新回调机制（供其他管理器使用）
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Logger } from '../../logger';

export class SceneManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private clock: THREE.Clock;
  private animationFrameId: number | null = null;
  private updateCallbacks: Set<(delta: number) => void> = new Set();
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement) {
    Logger.debug('SceneManager: 初始化场景管理器');

    // 1. 初始化场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x212121);

    // 2. 初始化相机
    const { width, height } = this.getCanvasSize(canvas);
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 20);
    this.camera.position.set(0, 1.3, 1.0);

    // 3. 初始化渲染器
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
      (this.renderer as any).outputEncoding = 3001; // THREE.sRGBEncoding
    }

    // 4. 初始化控制器
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 1.3, 0);
    this.controls.enableDamping = true;
    this.controls.enableZoom = true;
    this.controls.enablePan = false;

    // 5. 初始化灯光
    this.setupLights();

    // 6. 时钟
    this.clock = new THREE.Clock();

    // 7. 开始渲染循环
    this.startRenderLoop();

    // 8. 监听窗口大小变化
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);

    // 9. 监听容器大小变化
    const parentElement = canvas.parentElement;
    if (parentElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      this.resizeObserver.observe(parentElement);
    }

    Logger.debug('SceneManager: 场景管理器初始化完成');
  }

  /**
   * 设置灯光
   */
  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(1, 1, 1).normalize();
    this.scene.add(directionalLight);
  }

  /**
   * 添加对象到场景
   */
  addToScene(object: THREE.Object3D): void {
    this.scene.add(object);
    Logger.debug('对象已添加到场景');
  }

  /**
   * 从场景移除对象
   */
  removeFromScene(object: THREE.Object3D): void {
    this.scene.remove(object);
    Logger.debug('对象已从场景移除');
  }

  /**
   * 注册更新回调（供其他管理器使用）
   */
  registerUpdateCallback(callback: (delta: number) => void): void {
    this.updateCallbacks.add(callback);
  }

  /**
   * 取消注册更新回调
   */
  unregisterUpdateCallback(callback: (delta: number) => void): void {
    this.updateCallbacks.delete(callback);
  }

  /**
   * 获取相机（供其他管理器使用，如视线跟踪）
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * 渲染循环
   */
  private startRenderLoop(): void {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);

      const delta = this.clock.getDelta();

      // 调用所有注册的更新回调
      this.updateCallbacks.forEach(callback => {
        try {
          callback(delta);
        } catch (error) {
          Logger.error('更新回调执行失败', error instanceof Error ? error : undefined);
        }
      });

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

  /**
   * 处理窗口大小变化
   */
  private handleResize(): void {
    const canvas = this.renderer.domElement;
    const { width, height } = this.getCanvasSize(canvas);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    Logger.debug('场景大小已更新', { width, height });
  }

  /**
   * 获取画布尺寸
   */
  private getCanvasSize(canvas: HTMLCanvasElement) {
    const parent = canvas.parentElement;
    return {
      width: parent?.clientWidth || canvas.clientWidth,
      height: parent?.clientHeight || canvas.clientHeight
    };
  }

  /**
   * 销毁资源
   */
  dispose(): void {
    Logger.debug('SceneManager: 销毁场景管理器');

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    window.removeEventListener('resize', this.handleResize);

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.updateCallbacks.clear();
    this.scene.clear();
    this.renderer.dispose();

    Logger.debug('SceneManager: 场景管理器已销毁');
  }
}
