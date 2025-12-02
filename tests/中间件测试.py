from langchain.agents.middleware import SummarizationMiddleware



import sys
import os
from pathlib import Path

# 获取项目根目录：当前脚本所在目录的父目录
PROJECT_ROOT = Path(__file__).parent.parent.resolve()

# 将项目根目录加入 Python 模块搜索路径
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from core.models import *
from core.dependencies import get_app_storage

# 初始化
factory = ModelFactory(get_app_storage())

model = factory.create_model("tongyi","qwen-plus-2025-07-28")


summarization_middleware = SummarizationMiddleware(
    model=model,
    trigger=("tokens", 4000), 
    keep=("messages", 20)   
)