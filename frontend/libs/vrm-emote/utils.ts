/**
 * VRM 表情控制共享工具函数
 */

/**
 * 缓动函数 - 三次方缓入缓出
 * 用于平滑的动画过渡
 */
export function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 口型和眨眼表情名称集合（用于快速查找）
 */
const LIP_SYNC_NAMES = new Set([
    'aa', 'ih', 'ou', 'ee', 'oh',
    'a', 'i', 'u', 'e', 'o'
]);

const BLINK_NAMES = new Set([
    'blink', 'blinkleft', 'blinkright'
]);

const MOUTH_KEYWORDS = [
    'mouth', 'lip', 'viseme', 'vrc.v_'
];

/**
 * 判断是否是口型表情或眨眼表情（优化版）
 * 使用 Set 查找替代数组遍历，性能提升 O(n) -> O(1)
 */
export function isLipSyncOrBlinkExpression(name: string): boolean {
    const lowerName = name.toLowerCase();

    // 快速查找：精确匹配
    if (LIP_SYNC_NAMES.has(lowerName) || BLINK_NAMES.has(lowerName)) {
        return true;
    }

    // 关键词匹配（避免误判其他表情）
    return MOUTH_KEYWORDS.some(keyword => lowerName.includes(keyword));
}

/**
 * 限制数值在指定范围内
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * 线性插值
 */
export function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
}
