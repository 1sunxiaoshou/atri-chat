import { useEffect, useState, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { cn } from '@/utils/cn';
import { useLanguage } from '@/contexts/LanguageContext';
import { getMotionCacheStats } from '@/components/vrm/hooks';

export interface PerformanceStats {
    // 基础性能
    fps: number;
    frameTime: number;
    memory: number;
    heapTotal: number;
    memoryGrowth: number;

    // 缓存统计
    cachedModels: number;
    cachedMotions: number;
    cachedBindings: number;
    motionCacheSize: number;
    motionCacheHitRate: number;

    // GPU 资源
    geometries: number;
    textures: number;
    materials: number;
    programs: number;
    drawCalls: number;
    triangles: number;

    // 动画状态
    activeAnimations: number;
    currentMotion: string;
    audioContextCount: number;
}

/**
 * VRM 性能监控组件
 * 显示 FPS、内存、GPU 资源使用情况、缓存统计
 */
export function PerformanceMonitor({ onUpdate }: { onUpdate: (stats: PerformanceStats) => void }) {
    const { gl } = useThree();

    // 使用 useRef 保持状态持久化
    const fpsRef = useRef({ current: 0, frames: 0, lastTime: performance.now() });
    const lastMemoryRef = useRef({ current: 0, lastCheckTime: performance.now() });

    useFrame(() => {
        fpsRef.current.frames++;
        const currentTime = performance.now();
        const elapsed = currentTime - fpsRef.current.lastTime;

        // 每秒更新一次
        if (elapsed >= 1000) {
            fpsRef.current.current = Math.round((fpsRef.current.frames * 1000) / elapsed);
            fpsRef.current.frames = 0;
            fpsRef.current.lastTime = currentTime;

            // 更新所有统计信息
            const memoryInfo = (performance as any).memory;
            const currentMemory = memoryInfo ? memoryInfo.usedJSHeapSize : 0;
            const memory = Math.round(currentMemory / 1048576);
            const heapTotal = memoryInfo ? Math.round(memoryInfo.totalJSHeapSize / 1048576) : 0;

            // 计算内存增长率 (MB/s)
            const timeDiff = currentTime - lastMemoryRef.current.lastCheckTime;
            const memoryDiff = currentMemory - lastMemoryRef.current.current;
            const memoryGrowth = memoryInfo && timeDiff > 0
                ? (memoryDiff / timeDiff * 1000 / 1048576)
                : 0;

            // 更新上次记录
            lastMemoryRef.current.current = currentMemory;
            lastMemoryRef.current.lastCheckTime = currentTime;

            // 获取缓存统计
            const motionCache = getMotionCacheStats();

            // 获取 GPU 资源信息
            const info = gl.info;
            const renderInfo = gl.info.render;

            const stats: PerformanceStats = {
                // 基础性能
                fps: fpsRef.current.current,
                frameTime: fpsRef.current.current > 0 ? 1000 / fpsRef.current.current : 0,
                memory,
                heapTotal,
                memoryGrowth: Math.round(memoryGrowth * 100) / 100,

                // 缓存统计
                cachedModels: 0, // useGLTF 缓存无法直接访问
                cachedMotions: motionCache.size,
                cachedBindings: 0, // 需要从外部传入
                motionCacheSize: motionCache.maxSize,
                motionCacheHitRate: 0, // 需要追踪

                // GPU 资源
                geometries: info.memory.geometries,
                textures: info.memory.textures,
                materials: 0, // Three.js 不直接提供
                programs: info.programs?.length || 0,
                drawCalls: renderInfo.calls,
                triangles: renderInfo.triangles,

                // 动画状态
                activeAnimations: 0, // 需要从外部传入
                currentMotion: '', // 需要从外部传入
                audioContextCount: 0, // 需要从外部传入
            };

                // 手动重置统计信息，以便下一帧重新计数
                gl.info.reset();

                onUpdate(stats);
            }
    });

    return null; // 不渲染任何 3D 内容
}

/**
 * 性能监控 UI 叠加层
 * 显示在画面左上角
 */
export function PerformanceOverlay({ stats }: { stats: PerformanceStats }) {
    const { t } = useLanguage();

    // FPS 颜色指示
    const getFpsColor = (fps: number) => {
        if (fps >= 55) return 'text-green-400';
        if (fps >= 30) return 'text-yellow-400';
        return 'text-red-400';
    };

    // 内存颜色指示
    const getMemoryColor = (memory: number) => {
        if (memory < 200) return 'text-green-400';
        if (memory < 500) return 'text-yellow-400';
        return 'text-red-400';
    };

    // 内存增长颜色指示
    const getGrowthColor = (growth: number) => {
        if (growth < 0.1) return 'text-green-400';
        if (growth < 1) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className="absolute top-4 left-4 z-20 pointer-events-none">
            <div className="bg-black/80 backdrop-blur-sm rounded-lg p-3 text-xs font-mono space-y-1 border border-white/10 shadow-lg max-w-xs">
                {/* 标题 */}
                <div className="text-white font-bold mb-2 border-b border-white/10 pb-1">
                    {t('performance.title')}
                </div>

                {/* FPS 和帧时间 */}
                <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-400">{t('performance.fps')}:</span>
                    <span className={cn('font-bold', getFpsColor(stats.fps))}>
                        {stats.fps} ({stats.frameTime.toFixed(1)}ms)
                    </span>
                </div>

                {/* 内存 */}
                <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-400">{t('performance.memory')}:</span>
                    <span className={cn('font-bold', getMemoryColor(stats.memory))}>
                        {stats.memory} / {stats.heapTotal} MB
                    </span>
                </div>

                {/* 内存增长率 */}
                {stats.memoryGrowth !== 0 && (
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-gray-400">{t('performance.memoryGrowth')}:</span>
                        <span className={cn('font-bold', getGrowthColor(Math.abs(stats.memoryGrowth)))}>
                            {stats.memoryGrowth > 0 ? '+' : ''}{stats.memoryGrowth.toFixed(2)} MB/s
                        </span>
                    </div>
                )}

                {/* 分隔线 */}
                <div className="border-t border-white/10 my-1" />

                {/* 缓存统计 */}
                <div className="text-gray-300 font-semibold">{t('performance.cache')}</div>
                <div className="flex items-center justify-between gap-4 pl-2">
                    <span className="text-gray-400">{t('performance.motions')}:</span>
                    <span className="text-blue-400 font-bold">
                        {stats.cachedMotions} / {stats.motionCacheSize}
                    </span>
                </div>

                {/* 分隔线 */}
                <div className="border-t border-white/10 my-1" />

                {/* GPU 资源 */}
                <div className="text-gray-300 font-semibold">{t('performance.gpuResources')}</div>
                <div className="flex items-center justify-between gap-4 pl-2">
                    <span className="text-gray-400">{t('performance.geometries')}:</span>
                    <span className="text-blue-400 font-bold">{stats.geometries}</span>
                </div>

                <div className="flex items-center justify-between gap-4 pl-2">
                    <span className="text-gray-400">{t('performance.textures')}:</span>
                    <span className="text-blue-400 font-bold">{stats.textures}</span>
                </div>

                <div className="flex items-center justify-between gap-4 pl-2">
                    <span className="text-gray-400">{t('performance.programs')}:</span>
                    <span className="text-blue-400 font-bold">{stats.programs}</span>
                </div>

                <div className="flex items-center justify-between gap-4 pl-2">
                    <span className="text-gray-400">{t('performance.drawCalls')}:</span>
                    <span className="text-blue-400 font-bold">{stats.drawCalls}</span>
                </div>

                <div className="flex items-center justify-between gap-4 pl-2">
                    <span className="text-gray-400">{t('performance.triangles')}:</span>
                    <span className="text-blue-400 font-bold">
                        {(stats.triangles / 1000).toFixed(1)}K
                    </span>
                </div>
            </div>
        </div>
    );
}

/**
 * 性能监控 Hook
 * 在 React 组件中使用
 */
export function usePerformanceStats() {
    const [stats, setStats] = useState<PerformanceStats>({
        fps: 0,
        frameTime: 0,
        memory: 0,
        heapTotal: 0,
        memoryGrowth: 0,
        cachedModels: 0,
        cachedMotions: 0,
        cachedBindings: 0,
        motionCacheSize: 20,
        motionCacheHitRate: 0,
        geometries: 0,
        textures: 0,
        materials: 0,
        drawCalls: 0,
        programs: 0,
        triangles: 0,
        activeAnimations: 0,
        currentMotion: '',
        audioContextCount: 0,
    });

    useEffect(() => {
        let frameCount = 0;
        let lastTime = performance.now();
        let animationFrameId: number;

        const updateStats = () => {
            frameCount++;
            const currentTime = performance.now();
            const elapsed = currentTime - lastTime;

            // 每秒更新一次
            if (elapsed >= 1000) {
                const fps = Math.round((frameCount * 1000) / elapsed);
                const memory = (performance as any).memory
                    ? Math.round((performance as any).memory.usedJSHeapSize / 1048576)
                    : 0;

                setStats({
                    fps,
                    frameTime: elapsed / frameCount,
                    memory,
                    heapTotal: 0,
                    memoryGrowth: 0,
                    cachedModels: 0,
                    cachedMotions: 0,
                    cachedBindings: 0,
                    motionCacheSize: 20,
                    motionCacheHitRate: 0,
                    geometries: 0, // 需要从 Three.js 获取
                    textures: 0,
                    materials: 0,
                    drawCalls: 0,
                    programs: 0,
                    triangles: 0,
                    activeAnimations: 0,
                    currentMotion: '',
                    audioContextCount: 0,
                });

                frameCount = 0;
                lastTime = currentTime;
            }

            animationFrameId = requestAnimationFrame(updateStats);
        };

        animationFrameId = requestAnimationFrame(updateStats);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return stats;
}
