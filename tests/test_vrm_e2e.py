"""VRM端到端测试（需要真实环境）

此测试需要：
1. 真实的数据库
2. 真实的TTS服务
3. VRM模型和动作数据

运行前确保：
- 数据库中有测试角色
- TTS服务可用
- VRM模型已上传
"""
import sys
import asyncio
import json
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.storage import AppStorage
from core.tts.factory import TTSFactory
from core.vrm import VRMService
from core.paths import get_path_manager


async def test_vrm_with_real_tts():
    """使用真实TTS测试VRM"""
    print("=" * 60)
    print("VRM端到端测试（真实环境）")
    print("=" * 60)
    
    # 初始化
    path_manager = get_path_manager()
    storage = AppStorage(db_path=path_manager.app_db_path)
    tts_factory = TTSFactory(db_path=path_manager.app_db_path)
    
    # 获取测试角色
    print("\n【步骤1】获取测试角色")
    characters = storage.list_characters()
    if not characters:
        print("❌ 数据库中没有角色，请先创建角色")
        return
    
    test_character = characters[0]
    character_id = test_character["character_id"]
    print(f"  使用角色: {test_character['name']} (ID: {character_id})")
    
    # 检查VRM模型
    vrm_model_id = test_character.get("vrm_model_id")
    if vrm_model_id:
        animations = storage.get_model_animations(vrm_model_id)
        print(f"  VRM模型: {vrm_model_id}")
        print(f"  可用动作: {len(animations)}个")
        for anim in animations[:3]:  # 只显示前3个
            print(f"    - {anim['name_cn']} ({anim['name']})")
    else:
        print("  ⚠️  角色未配置VRM模型，将使用默认动作")
    
    # 创建VRM服务
    print("\n【步骤2】创建VRM服务")
    vrm_service = VRMService(storage, tts_factory, parallel_tts=True)
    context = vrm_service.create_vrm_context(character_id)
    print(f"  ✓ VRM上下文创建成功")
    print(f"  动作映射: {len(context.action_mapping)}个")
    
    # 测试文本
    test_text = "[State:开心][Action:打招呼]你好！[State:好奇]今天想聊点什么？"
    print(f"\n【步骤3】生成VRM音频")
    print(f"  测试文本: {test_text}")
    
    # 生成音频
    segments_count = 0
    total_duration = 0.0
    
    try:
        async for chunk in vrm_service.generate_vrm_audio_segments(test_text, context):
            data = json.loads(chunk)
            
            if data.get("type") == "vrm_audio_segment":
                segment = data["segment"]
                segments_count += 1
                print(f"\n  音频段 {segments_count}:")
                print(f"    文本: {segment['text']}")
                print(f"    时长: {segment['duration']:.2f}秒")
                print(f"    时间: {segment['start_time']:.2f}s - {segment['end_time']:.2f}s")
                print(f"    标记: {len(segment['markups'])}个")
                for markup in segment['markups']:
                    print(f"      - {markup['type']}: {markup['value']} @ {markup['timestamp']:.2f}s")
                print(f"    音频URL: {segment['audio_url']}")
                
            elif data.get("type") == "vrm_audio_complete":
                total_duration = data.get("total_duration", 0.0)
                print(f"\n  ✓ 音频生成完成")
                print(f"  总段数: {data.get('total_segments', 0)}")
                print(f"  总时长: {total_duration:.2f}秒")
                
            elif data.get("type") == "vrm_error":
                print(f"\n  ❌ 错误: {data.get('error')}")
                print(f"  详情: {data.get('details')}")
        
        print("\n" + "=" * 60)
        print("✅ VRM端到端测试完成")
        print("=" * 60)
        print(f"生成了 {segments_count} 个音频段，总时长 {total_duration:.2f}秒")
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()


async def test_vrm_performance():
    """测试VRM性能（串行 vs 并行）"""
    print("\n" + "=" * 60)
    print("VRM性能测试")
    print("=" * 60)
    
    # 初始化
    path_manager = get_path_manager()
    storage = AppStorage(db_path=path_manager.app_db_path)
    tts_factory = TTSFactory(db_path=path_manager.app_db_path)
    
    # 获取测试角色
    characters = storage.list_characters()
    if not characters:
        print("❌ 数据库中没有角色")
        return
    
    character_id = characters[0]["character_id"]
    
    # 生成较长的测试文本（5句话）
    test_text = """[State:开心]你好！
[State:好奇]今天想聊点什么？
[State:开心]我可以帮你解答问题。
[State:中性]或者我们可以随便聊聊。
[State:开心]期待与你的交流！"""
    
    print(f"\n测试文本: {len(test_text)}字符，约5句话")
    
    # 测试串行模式
    print("\n【测试1】串行模式")
    import time
    
    vrm_service_serial = VRMService(storage, tts_factory, parallel_tts=False)
    context = vrm_service_serial.create_vrm_context(character_id)
    
    start = time.time()
    serial_segments = 0
    
    try:
        async for chunk in vrm_service_serial.generate_vrm_audio_segments(test_text, context):
            data = json.loads(chunk)
            if data.get("type") == "vrm_audio_segment":
                serial_segments += 1
    except Exception as e:
        print(f"  ❌ 串行模式失败: {e}")
    
    serial_time = time.time() - start
    print(f"  耗时: {serial_time:.2f}秒")
    print(f"  音频段: {serial_segments}个")
    
    # 测试并行模式
    print("\n【测试2】并行模式")
    
    vrm_service_parallel = VRMService(storage, tts_factory, parallel_tts=True)
    
    start = time.time()
    parallel_segments = 0
    
    try:
        async for chunk in vrm_service_parallel.generate_vrm_audio_segments(test_text, context):
            data = json.loads(chunk)
            if data.get("type") == "vrm_audio_segment":
                parallel_segments += 1
    except Exception as e:
        print(f"  ❌ 并行模式失败: {e}")
    
    parallel_time = time.time() - start
    print(f"  耗时: {parallel_time:.2f}秒")
    print(f"  音频段: {parallel_segments}个")
    
    # 性能对比
    if serial_time > 0 and parallel_time > 0:
        speedup = serial_time / parallel_time
        print(f"\n【性能对比】")
        print(f"  串行: {serial_time:.2f}秒")
        print(f"  并行: {parallel_time:.2f}秒")
        print(f"  提升: {speedup:.2f}x")
        
        if speedup > 1.2:
            print(f"  ✅ 并行模式显著更快")
        elif speedup > 0.8:
            print(f"  ⚠️  性能相近")
        else:
            print(f"  ⚠️  并行模式反而更慢（可能是测试环境问题）")


async def main():
    """主测试函数"""
    try:
        # 基础功能测试
        await test_vrm_with_real_tts()
        
        # 性能测试
        await test_vrm_performance()
        
    except KeyboardInterrupt:
        print("\n\n测试被中断")
    except Exception as e:
        print(f"\n❌ 测试出错: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("\n⚠️  注意：此测试需要真实的数据库和TTS服务")
    print("确保已经：")
    print("  1. 配置了数据库")
    print("  2. 创建了测试角色")
    print("  3. TTS服务可用")
    print("\n按 Ctrl+C 取消，或按 Enter 继续...")
    
    try:
        input()
    except KeyboardInterrupt:
        print("\n测试已取消")
        sys.exit(0)
    
    asyncio.run(main())
