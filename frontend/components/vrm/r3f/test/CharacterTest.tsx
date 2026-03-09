import { Suspense, useState } from 'react';
import { VRMCanvas } from '../core/VRMCanvas';
import { StudioScene } from '../scenes/StudioScene';
import { Character } from '../core/Character';

/**
 * Character 组件测试
 * 用于验证 VRM 加载、表情、动作、眨眼、视线等功能
 */
export function CharacterTest() {
    const [expression, setExpression] = useState<string>('neutral');
    const [lookAtMode, setLookAtMode] = useState<'mouse' | 'camera' | 'none'>('mouse');

    // 替换为你的 VRM 模型 URL
    const modelUrl = '/path/to/your/model.vrm';

    return (
        <div className="w-full h-screen bg-slate-900">
            {/* 3D 渲染区域 */}
            <VRMCanvas>
                <Suspense fallback={null}>
                    <StudioScene>
                        <Character
                            url={modelUrl}
                            expression={expression}
                            enableBlink={true}
                            lookAtMode={lookAtMode}
                        />
                    </StudioScene>
                </Suspense>
            </VRMCanvas>

            {/* 控制面板 */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col gap-4 bg-slate-800/90 p-6 rounded-lg backdrop-blur-sm">
                {/* 表情控制 */}
                <div>
                    <label className="text-white text-sm mb-2 block">表情</label>
                    <div className="flex gap-2">
                        {['neutral', 'happy', 'angry', 'sad', 'relaxed'].map((exp) => (
                            <button
                                key={exp}
                                onClick={() => setExpression(exp)}
                                className={`px-4 py-2 rounded ${expression === exp
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                            >
                                {exp}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 视线控制 */}
                <div>
                    <label className="text-white text-sm mb-2 block">视线跟随</label>
                    <div className="flex gap-2">
                        {[
                            { value: 'mouse', label: '鼠标' },
                            { value: 'camera', label: '摄像机' },
                            { value: 'none', label: '无' },
                        ].map((mode) => (
                            <button
                                key={mode.value}
                                onClick={() => setLookAtMode(mode.value as any)}
                                className={`px-4 py-2 rounded ${lookAtMode === mode.value
                                        ? 'bg-green-500 text-white'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                            >
                                {mode.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="text-slate-400 text-xs text-center">
                    提示：移动鼠标查看视线跟随效果，模型会自动眨眼
                </div>
            </div>
        </div>
    );
}
