import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils, VRM } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin} from '@pixiv/three-vrm-animation';
import { AnimationTransitionManager } from './animationTransition';
import { EmoteController } from '../libs/emoteController/emoteController';
import { AutoLookAt } from '../libs/emoteController/autoLookAt';
import { Logger } from './logger';

/**
 * Helper function to extract animation duration from a file (e.g. .vrma)
 */
export async function getAnimationDuration(file: File): Promise<number> {
    const url = URL.createObjectURL(file);
    const loader = new GLTFLoader();
    // Register VRMA plugin
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

    try {
        const gltf = await loader.loadAsync(url);

        // Check for VRM Animations
        const vrmAnimations = gltf.userData.vrmAnimations;
        if (vrmAnimations && vrmAnimations.length > 0) {
            // Usually VRMA contains one clip
            return vrmAnimations[0].duration;
        }

        // Check for standard glTF animations
        if (gltf.animations && gltf.animations.length > 0) {
            const firstAnimation = gltf.animations[0];
            return firstAnimation ? firstAnimation.duration : 0;
        }

        return 0;
    } catch (error) {
        Logger.error('Failed to parse animation duration', error instanceof Error ? error : undefined);
        return 0;
    } finally {
        URL.revokeObjectURL(url);
    }
}

/**
 * VRM资源管理器
 * 负责VRM模型加载、动作加载、场景渲染
 */
export class VRMLoader {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private clock: THREE.Clock;

    private currentVrm: VRM | null = null;
    private mixer: THREE.AnimationMixer | null = null;
    public transitionManager: AnimationTransitionManager | null = null;
    public emoteController: EmoteController | null = null;
    private autoLookAt: AutoLookAt | null = null;


    // 渲染循环ID
    private animationFrameId: number | null = null;

    // ResizeObserver instance
    private resizeObserver: ResizeObserver | null = null;

    constructor(canvas: HTMLCanvasElement) {
        Logger.info('初始化VRM加载器');

        // 1. 场景设置
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x212121);

        // 获取正确的容器尺寸
        const parentElement = canvas.parentElement;
        const width = parentElement ? parentElement.clientWidth : canvas.clientWidth;
        const height = parentElement ? parentElement.clientHeight : canvas.clientHeight;

        // 2. 相机设置
        this.camera = new THREE.PerspectiveCamera(
            50, // 增加视野角度，让角色显示更大
            width / height,
            0.1,
            20
        );
        this.camera.position.set(0, 1.3, 1.0); // 拉近相机距离

        // 3. 渲染器设置
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

        // 4. 控制器设置
        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.target.set(0, 1.3, 0);
        this.controls.enableDamping = true;
        this.controls.enableZoom = true;
        this.controls.enablePan = false;

        // 5. 灯光设置
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(1, 1, 1).normalize();
        this.scene.add(directionalLight);

        // 6. 时钟
        this.clock = new THREE.Clock();

        // 开始渲染循环
        this.animate();

        // 监听 window resize
        window.addEventListener('resize', this.onResize);

        // 监听容器 resize
        if (parentElement) {
            this.resizeObserver = new ResizeObserver(() => {
                this.onResize();
            });
            this.resizeObserver.observe(parentElement);
        }
    }

    /**
     * 加载VRM模型
     */
    async loadModel(url: string): Promise<VRM> {
        const loader = new GLTFLoader();

        // 注册VRM插件
        loader.register((parser) => {
            return new VRMLoaderPlugin(parser);
        });

        try {
            Logger.info('开始加载VRM模型', { url });

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
                if (this.mixer) {this.mixer.stopAllAction();}
                VRMUtils.deepDispose(this.currentVrm.scene);
            }

            this.currentVrm = vrm;
            this.scene.add(vrm.scene);

            // 禁用视锥剔除和描边
			vrm.scene.traverse((obj: any) => {
				obj.frustumCulled = false;
				// 移除 MToon 材质的描边
				if (obj.material) {
					const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
					materials.forEach((mat: { isMToonMaterial: any; outlineWidthMode: string; outlineWidthFactor: number; outlineLightingMixFactor: number; needsUpdate: boolean; outlineWidth: number | undefined; }) => {
						// MToon 材质的描边属性
						if (mat.isMToonMaterial) {
							mat.outlineWidthMode = 'none';
							mat.outlineWidthFactor = 0;
							mat.outlineLightingMixFactor = 0;
							mat.needsUpdate = true;
						}
						// 通用属性
						if (mat.outlineWidth !== undefined) {
							mat.outlineWidth = 0;
						}
					});
				}
			});

            // 初始化动画混合器
            this.mixer = new THREE.AnimationMixer(vrm.scene);
            this.transitionManager = new AnimationTransitionManager(this.mixer);
            
            // 初始化情感控制器（统一管理表情和动作）
            this.emoteController = new EmoteController(vrm);

            // 初始化自动视线跟踪（让角色眼睛看向相机）
            this.autoLookAt = new AutoLookAt(vrm, this.camera);

            Logger.info('VRM模型加载成功');

            // 注意：不在这里自动加载闲置动画
            // 闲置动画应该在外部设置 URL 后手动调用 loadIdleAnimation()

            return vrm;
        } catch (error) {
            Logger.error('VRM模型加载失败', error instanceof Error ? error : undefined);

            // 显示默认占位符
            this.showDefaultAvatar();

            throw new Error(`VRM模型加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 显示默认头像（当VRM加载失败时）
     */
    private showDefaultAvatar(): void {
        // 创建一个简单的几何体作为占位符
        const geometry = new THREE.BoxGeometry(0.3, 0.4, 0.2);
        const material = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const defaultAvatar = new THREE.Mesh(geometry, material);

        defaultAvatar.position.set(0, 1.3, 0);
        this.scene.add(defaultAvatar);

        Logger.info('显示默认头像占位符');
    }


    /**
     * 设置表情
     * 使用情感控制器统一管理
     */
    setExpression(presetName: string): void {
        if (!this.emoteController) {
            // 模型未加载时静默返回（这是正常情况）
            return;
        }

        try {
            // 使用情感控制器播放表情
            this.emoteController.playEmotion(presetName);
            Logger.debug(`设置表情: ${presetName}`);
        } catch (error) {
            Logger.error(`设置表情失败: ${presetName}`, error instanceof Error ? error : undefined);
        }
    }

    /**
     * 更新口型同步
     * 使用情感控制器统一管理
     */
    updateLipSync(volume: number): void {
        if (!this.emoteController) {
            return;
        }

        // 调整口型大小：降低系数让嘴巴张得小一点
        // 原来是 * 2.0，现在改为 * 0.8 让嘴巴张得更小
        const adjustedVolume = Math.sqrt(volume) * 0.8;
        const value = Math.min(1.0, adjustedVolume);

        // 使用情感控制器的口型同步方法
        this.emoteController.lipSync('aa', value);

        if (value > 0.1) {
            Logger.debug(`口型同步: aa = ${value.toFixed(3)}`);
        }
    }

    /**
     * 更新尺寸
     */
    resize(width: number, height: number): void {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    private onResize = () => {
        // 处理窗口大小变化
        if (!this.renderer || !this.renderer.domElement) {return;}

        const canvas = this.renderer.domElement;
        const parentElement = canvas.parentElement;

        if (parentElement) {
            this.resize(parentElement.clientWidth, parentElement.clientHeight);
        } else {
            this.resize(window.innerWidth, window.innerHeight);
        }
    };

    /**
     * 每一帧的更新
     */
    private animate = () => {
        this.animationFrameId = requestAnimationFrame(this.animate);

        const deltaTime = this.clock.getDelta();

        if (this.currentVrm) {
            this.currentVrm.update(deltaTime);
        }

        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        // 更新情感控制器（包含表情和动作）
        if (this.emoteController) {
            this.emoteController.update(deltaTime);
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    };

    /**
     * 加载闲置动画
     * 参考 lobe-vidol 的 loadIdleAnimation
     */
    public async loadIdleAnimation(): Promise<void> {
        if (!this.emoteController) {
            // 模型未加载时静默返回
            return;
        }

        try {
            await this.emoteController.loadIdleAnimation();
            Logger.info('闲置动画加载成功');
        } catch (error) {
            Logger.error('闲置动画加载失败', error instanceof Error ? error : undefined);
        }
    }

    /**
     * 重置到闲置状态
     * 参考 lobe-vidol 的 resetToIdle
     */
    public async resetToIdle(): Promise<void> {
        if (!this.emoteController) {
            // 模型未加载时静默返回
            return;
        }

        try {
            await this.emoteController.resetToIdle();
            Logger.info('已重置到闲置状态');
        } catch (error) {
            Logger.error('重置到闲置状态失败', error instanceof Error ? error : undefined);
        }
    }

    /**
     * 设置闲置动画 URL
     */
    public setIdleAnimationUrl(url: string): void {
        if (this.emoteController) {
            this.emoteController.setIdleAnimationUrl(url);
        }
    }

    /**
     * 预加载动画
     */
    public async preloadAnimation(name: string, url: string): Promise<void> {
        if (!this.emoteController) {
            // 模型未加载时静默返回
            return;
        }

        await this.emoteController.preloadAnimation(name, url);
    }

    /**
     * 批量预加载动画
     */
    public async preloadAnimations(
        animations: Record<string, string>,
        onProgress?: (loaded: number, total: number) => void
    ): Promise<void> {
        if (!this.emoteController) {
            // 模型未加载时静默返回
            return;
        }

        await this.emoteController.preloadAnimations(animations, onProgress);
    }

    /**
     * 播放动画（通过名称）
     */
    public async playAnimation(name: string, loop: boolean = true): Promise<void> {
        if (!this.emoteController) {
            // 模型未加载时静默返回
            return;
        }

        await this.emoteController.playAnimation(name, loop);
    }

    /**
     * 播放动画（通过 URL）
     */
    public async playAnimationUrl(url: string, loop: boolean = true): Promise<void> {
        if (!this.emoteController) {
            // 模型未加载时静默返回
            return;
        }

        await this.emoteController.playAnimationUrl(url, loop);
    }

    /**
     * 获取已加载的动画列表
     */
    public getLoadedAnimations(): string[] {
        return this.emoteController?.getLoadedAnimations() ?? [];
    }

    /**
     * 检查动画是否已加载
     */
    public isAnimationLoaded(name: string): boolean {
        return this.emoteController?.isAnimationLoaded(name) ?? false;
    }

    /**
     * 获取当前动作信息
     */
    public getCurrentMotionInfo() {
        return this.emoteController?.getCurrentMotionInfo() ?? null;
    }

    /**
     * 获取当前表情
     */
    public getCurrentExpression(): string | null {
        return this.emoteController?.getCurrentExpression() ?? null;
    }

    /**
     * 检查是否正在播放动作
     */
    public isMotionPlaying(): boolean {
        return this.emoteController?.isMotionPlaying() ?? false;
    }

    /**
     * 启用/禁用自动眨眼
     */
    public setAutoBlinkEnabled(enabled: boolean): void {
        if (this.emoteController) {
            this.emoteController.setAutoBlinkEnabled(enabled);
            Logger.info(`自动眨眼已${enabled ? '启用' : '禁用'}`);
        }
    }

    /**
     * 检查是否正在眨眼
     */
    public isBlinking(): boolean {
        return this.emoteController?.isBlinking() ?? false;
    }

    /**
     * 启用/禁用自动视线跟踪
     */
    public setAutoLookAtEnabled(enabled: boolean): void {
        if (this.autoLookAt) {
            this.autoLookAt.setEnable(enabled);
            Logger.info(`自动视线跟踪已${enabled ? '启用' : '禁用'}`);
        }
    }

    /**
     * 设置自定义视线目标
     * @param target 目标对象，如果为 null 则恢复跟随相机
     */
    public setLookAtTarget(target: THREE.Object3D | null): void {
        if (this.autoLookAt) {
            this.autoLookAt.setTarget(target);
        }
    }

    /**
     * 检查视线跟踪是否启用
     */
    public isLookAtEnabled(): boolean {
        return this.autoLookAt?.isLookAtEnabled() ?? false;
    }

    /**
     * 获取可用的表情列表
     */
    public getAvailableExpressions(): string[] {
        if (!this.currentVrm?.expressionManager) {
            return [];
        }
        return Object.keys(this.currentVrm.expressionManager.expressionMap);
    }

    /**
     * 销毁资源
     */
    dispose(): void {
        Logger.info('销毁VRM加载器');

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        window.removeEventListener('resize', this.onResize);

        // 清理 ResizeObserver
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // 清理自动视线跟踪
        if (this.autoLookAt) {
            this.autoLookAt.dispose();
            this.autoLookAt = null;
        }

        // 清理情感控制器
        if (this.emoteController) {
            this.emoteController.dispose();
            this.emoteController = null;
        }

        this.scene.clear();
        this.renderer.dispose();

        if (this.currentVrm) {
            VRMUtils.deepDispose(this.currentVrm.scene);
        }
    }
}