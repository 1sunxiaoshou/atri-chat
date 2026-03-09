import { VRM } from '@pixiv/three-vrm';
import { useEffect, useRef } from 'react';

interface BlinkController {
    update: (delta: number) => void;
}

/**
 * 自动眨眼 Hook
 * 实现自然的眨眼动画
 * 
 * @param vrm - VRM 实例
 * @param enabled - 是否启用自动眨眼
 * @returns 控制器引用
 */
export function useAutoBlink(
    vrm: VRM | null,
    enabled: boolean = true
) {
    const controllerRef = useRef<BlinkController | null>(null);
    const nextBlinkTimeRef = useRef(0);
    const blinkProgressRef = useRef(0);
    const isBlinkingRef = useRef(false);

    useEffect(() => {
        if (!vrm || !enabled) {
            controllerRef.current = null;
            return;
        }

        // 生成随机眨眼间隔（2-6秒）
        const getNextBlinkTime = () => {
            return Math.random() * 4 + 2;
        };

        nextBlinkTimeRef.current = getNextBlinkTime();

        controllerRef.current = {
            update: (delta: number) => {
                if (!vrm.expressionManager) return;

                if (isBlinkingRef.current) {
                    // 眨眼动画进行中
                    blinkProgressRef.current += delta * 10; // 眨眼速度

                    if (blinkProgressRef.current < 1) {
                        // 闭眼阶段
                        const value = Math.sin(blinkProgressRef.current * Math.PI);
                        vrm.expressionManager.setValue('blink', value);
                    } else {
                        // 眨眼完成
                        vrm.expressionManager.setValue('blink', 0);
                        isBlinkingRef.current = false;
                        blinkProgressRef.current = 0;
                        nextBlinkTimeRef.current = getNextBlinkTime();
                    }
                } else {
                    // 等待下次眨眼
                    nextBlinkTimeRef.current -= delta;

                    if (nextBlinkTimeRef.current <= 0) {
                        isBlinkingRef.current = true;
                    }
                }
            },
        };

        return () => {
            if (vrm.expressionManager) {
                vrm.expressionManager.setValue('blink', 0);
            }
        };
    }, [vrm, enabled]);

    return controllerRef;
}
