import sys
import os
from pathlib import Path

# 获取项目根目录：当前脚本所在目录的父目录
PROJECT_ROOT = Path(__file__).parent.parent.resolve()

# 将项目根目录加入 Python 模块搜索路径
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from langchain.agents import create_agent
from langchain_community.chat_models.tongyi import ChatTongyi

lln = ChatTongyi(api_key=os.getenv("DASHSCOPE_API_KEY"), streaming=True)
agent = create_agent(lln)

for token, metadata in agent.stream(  
    {"messages": [{"role": "user", "content": "你好文"}]},
    stream_mode="messages",
):
    print(f"node: {metadata['langgraph_node']}")
    print(f"content: {token.content_blocks}")
    print("\n")