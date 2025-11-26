import sys
import os
from pathlib import Path

# 获取项目根目录：当前脚本所在目录的父目录
PROJECT_ROOT = Path(__file__).parent.parent.resolve()

# 将项目根目录加入 Python 模块搜索路径
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from core.models import *

# 初始化
storage = ModelStorage("./data/models.db")
factory = ModelFactory(storage)

# # 添加供应商配置
# provider = ProviderConfig(
#     provider_id="tongyi",
#     config_json={
#         "api_key": "sk-90219149368d460284c9aa4ebf559044",
#         "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1"}
# )
# storage.add_provider(provider)

# # 添加模型
# model = ModelConfig(
#     model_id="qwen-plus",
#     provider_id="tongyi",
#     model_type=ModelType.TEXT,
#     mode=TextMode.CHAT,
#     enabled=True
# )

# storage.add_model(model)


print(storage.get_providers_with_models())
