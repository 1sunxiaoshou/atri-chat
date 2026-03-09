import { VRMCanvas } from '../core/VRMCanvas';
import { StudioScene } from '../scenes/StudioScene';
import { AIStage } from '../scenes/AIStage';

/**
 * R3F 基础设施测试组件
 * 用于验证 VRMCanvas、StudioScene 和 AIStage 是否正常工作
 */
export function TestStudioScene() {
    return (
        <div className="w-full h-screen bg-slate-900">
            <VRMCanvas>
                <StudioScene>
                    {/* 测试用立方体 */}
                    <mesh position={[0, 1, 0]}>
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color="hotpink" />
                    </mesh>
                </StudioScene>
            </VRMCanvas>
        </div>
    );
}

export function TestAIStage() {
    return (
        <div className="w-full h-screen bg-slate-900">
            <VRMCanvas>
                <AIStage environment="apartment" enablePostProcessing={true}>
                    {/* 测试用球体 */}
                    <mesh position={[0, 1, 0]}>
                        <sphereGeometry args={[0.5, 32, 32]} />
                        <meshStandardMaterial color="cyan" metalness={0.8} roughness={0.2} />
                    </mesh>
                </AIStage>
            </VRMCanvas>
        </div>
    );
}

// 导出 Character 测试组件
export { CharacterTest } from './CharacterTest';
