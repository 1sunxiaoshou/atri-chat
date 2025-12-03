"""路径管理器测试"""
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.paths import get_path_manager, get_app_db_path, get_logs_dir


def test_path_manager():
    """测试路径管理器基本功能"""
    print("=" * 60)
    print("路径管理器测试")
    print("=" * 60)
    
    pm = get_path_manager()
    
    # 测试基本路径
    print(f"\n项目根目录: {pm.root}")
    print(f"数据目录: {pm.data_dir}")
    print(f"日志目录: {pm.logs_dir}")
    print(f"静态文件目录: {pm.static_dir}")
    print(f"上传文件目录: {pm.uploads_dir}")
    print(f"头像目录: {pm.avatars_dir}")
    print(f"ASR模型目录: {pm.asr_models_dir}")
    print(f"前端构建目录: {pm.frontend_dist}")
    
    # 测试数据库路径
    print(f"\n应用数据库: {pm.app_db}")
    print(f"Store数据库: {pm.store_db}")
    print(f"Checkpoints数据库: {pm.checkpoints_db}")
    
    # 测试便捷函数
    print(f"\n便捷函数测试:")
    print(f"get_app_db_path(): {get_app_db_path()}")
    print(f"get_logs_dir(): {get_logs_dir()}")
    
    # 测试路径规范化
    print(f"\n路径规范化测试:")
    test_path = r"C:\\Users\\test\\path"
    print(f"原始路径: {test_path}")
    print(f"规范化后: {pm.normalize_path(test_path)}")
    
    # 测试模型路径解析
    print(f"\n模型路径解析测试:")
    test_model_paths = [
        "./asr_models/model1",
        "model2",
        r"E:\absolute\path\model3"
    ]
    for path in test_model_paths:
        resolved = pm.resolve_model_path(path)
        print(f"{path} -> {resolved}")
    
    # 验证目录是否创建
    print(f"\n目录创建验证:")
    dirs_to_check = [
        pm.data_dir,
        pm.logs_dir,
        pm.static_dir,
        pm.uploads_dir,
        pm.avatars_dir,
        pm.asr_models_dir
    ]
    for dir_path in dirs_to_check:
        exists = dir_path.exists()
        print(f"{'✓' if exists else '✗'} {dir_path} {'存在' if exists else '不存在'}")
    
    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)


if __name__ == "__main__":
    test_path_manager()
