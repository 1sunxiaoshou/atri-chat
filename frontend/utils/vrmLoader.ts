import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils, VRM } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin } from '@pixiv/three-vrm-animation';
import { AnimationTransitionManager } from './animationTransition';

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

    // 存储加载的动画
    private animations: Map<string, THREE.AnimationClip> = new Map();

    // 渲染循环ID
    private animationFrameId: number | null = null;

    // ResizeObserver instance
    private resizeObserver: ResizeObserver | null = null;

    constructor(canvas: HTMLCanvasElement) {
        console.log('初始化VRM加载器');

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
            console.log('开始加载VRM模型:', url);

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
                if (this.mixer) this.mixer.stopAllAction();
                VRMUtils.deepDispose(this.currentVrm.scene);
            }

            this.currentVrm = vrm;
            this.scene.add(vrm.scene);

            // 初始化动画混合器
            this.mixer = new THREE.AnimationMixer(vrm.scene);
            this.transitionManager = new AnimationTransitionManager(this.mixer);

            console.log('VRM模型加载成功');
            return vrm;
        } catch (error) {
            console.error('VRM模型加载失败:', error);

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

        console.log('显示默认头像占位符');
    }

    /**
     * 加载动作文件
     */
    async loadAnimations(animationMap: Record<string, string>): Promise<void> {
        if (!this.currentVrm) {
            console.warn('请先加载模型');
            return;
        }

        const loader = new GLTFLoader();
        loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

        for (const [name, url] of Object.entries(animationMap)) {
            try {
                console.log(`加载动画: ${name}`);
                const gltf = await loader.loadAsync(url);
                const vrmAnimations = gltf.userData.vrmAnimations;

                if (vrmAnimations && vrmAnimations.length > 0) {
                    const clip = vrmAnimations[0];
                    this.animations.set(name, clip);
                    console.log(`动画加载成功: ${name}`);
                }
            } catch (error) {
                console.warn(`动画加载失败: ${name}`, error);
            }
        }
    }

    /**
     * 播放动作
     */
    playAction(name: string, loop: boolean = true): void {
        if (!this.transitionManager) {
            console.warn('动画管理器未初始化');
            return;
        }

        const clip = this.animations.get(name);
        if (clip) {
            try {
                this.transitionManager.playWithTransition(clip, { loop });
                console.log(`播放动作: ${name}`);
            } catch (error) {
                console.error(`播放动作失败: ${name}`, error);
            }
        } else {
            console.warn(`未找到动作: ${name}，可用动作:`, Array.from(this.animations.keys()));
        }
    }

    /**
     * 设置表情
     */
    setExpression(presetName: string, outputValue: number = 1.0): void {
        if (!this.currentVrm || !this.currentVrm.expressionManager) {
            console.warn('VRM模型或表情管理器未初始化');
            return;
        }

        try {
            const expressionManager = this.currentVrm.expressionManager;

            // 重置所有表情到0
            const expressionNames = Object.keys(expressionManager.expressionMap);
            for (const name of expressionNames) {
                expressionManager.setValue(name, 0);
            }

            // 设置目标表情
            if (presetName in expressionManager.expressionMap) {
                expressionManager.setValue(presetName, outputValue);
                console.log(`设置表情: ${presetName} = ${outputValue}`);
            } else {
                console.warn(`未找到表情: ${presetName}，可用表情:`, expressionNames);
            }
        } catch (error) {
            console.error(`设置表情失败: ${presetName}`, error);
        }
    }

    /**
     * 更新口型同步
     */
    updateLipSync(volume: number): void {
        if (!this.currentVrm || !this.currentVrm.expressionManager) return;

        const vowel = 'aa';
        const value = Math.min(1.0, volume * 5.0);

        this.currentVrm.expressionManager.setValue(vowel, value);
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
        if (!this.renderer || !this.renderer.domElement) return;

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

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    };

    /**
     * 销毁资源
     */
    dispose(): void {
        console.log('销毁VRM加载器');

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        window.removeEventListener('resize', this.onResize);

        this.scene.clear();
        this.renderer.dispose();

        if (this.currentVrm) {
            VRMUtils.deepDispose(this.currentVrm.scene);
        }
    }
}