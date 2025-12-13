"""VRM测试运行器

快速运行VRM相关测试的脚本
"""
import sys
import subprocess
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))


def run_test(test_file: str, description: str):
    """运行单个测试文件"""
    print("\n" + "=" * 70)
    print(f"运行测试: {description}")
    print("=" * 70)
    
    test_path = Path(__file__).parent / test_file
    
    if not test_path.exists():
        print(f"❌ 测试文件不存在: {test_file}")
        return False
    
    try:
        result = subprocess.run(
            [sys.executable, str(test_path)],
            capture_output=False,
            text=True
        )
        
        if result.returncode == 0:
            print(f"✅ {description} - 通过")
            return True
        else:
            print(f"❌ {description} - 失败")
            return False
            
    except Exception as e:
        print(f"❌ 运行测试时出错: {e}")
        return False


def main():
    """主函数"""
    print("=" * 70)
    print("VRM测试套件")
    print("=" * 70)
    
    tests = [
        ("test_vrm_parser.py", "标记解析器测试"),
        ("test_vrm_fixes.py", "VRM修复测试"),
        ("test_vrm_dynamic_mapping.py", "动态动作映射测试"),
        ("test_vrm_complete.py", "完整功能测试（模拟）"),
    ]
    
    results = []
    
    for test_file, description in tests:
        success = run_test(test_file, description)
        results.append((description, success))
    
    # 总结
    print("\n" + "=" * 70)
    print("测试总结")
    print("=" * 70)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for description, success in results:
        status = "✅ 通过" if success else "❌ 失败"
        print(f"{status} - {description}")
    
    print("\n" + "-" * 70)
    print(f"总计: {passed}/{total} 通过")
    
    if passed == total:
        print("🎉 所有测试通过！")
        return 0
    else:
        print(f"⚠️  有 {total - passed} 个测试失败")
        return 1


if __name__ == "__main__":
    try:
        exit_code = main()
        
        # 询问是否运行端到端测试
        print("\n" + "=" * 70)
        print("是否运行端到端测试？（需要真实环境）")
        print("=" * 70)
        print("端到端测试需要：")
        print("  - 真实的数据库")
        print("  - 配置好的TTS服务")
        print("  - 测试角色数据")
        print("\n输入 'y' 运行，其他键跳过...")
        
        choice = input().strip().lower()
        
        if choice == 'y':
            run_test("test_vrm_e2e.py", "端到端测试（真实环境）")
        else:
            print("跳过端到端测试")
        
        sys.exit(exit_code)
        
    except KeyboardInterrupt:
        print("\n\n测试被中断")
        sys.exit(1)
