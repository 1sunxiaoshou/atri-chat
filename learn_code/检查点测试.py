import sqlite3
from langgraph.checkpoint.sqlite import SqliteSaver

import os
from pprint import pprint
from dotenv import load_dotenv

# 设置路径到项目根目录
project_root = os.path.dirname(os.path.abspath(__file__))
os.chdir(project_root)

# 读取.env文件
load_dotenv()

from langchain.chat_models import init_chat_model
from langchain.agents import create_agent


basic_model = init_chat_model(
    model=os.getenv("MODEL"),
    model_provider="openai",
    base_url = os.getenv("BASE_URL"),
    api_key=os.getenv("DASHSCOPE_API_KEY"))

conn = sqlite3.connect("checkpoints.sqlite", check_same_thread=False)
checkpointer = SqliteSaver(conn)


# agent = create_agent(
#     model=basic_model,  # Default model
#     system_prompt="你是一个AI助手",
#     checkpointer=checkpointer
# )

# # result = agent.invoke(
# #     {"messages": [{"role": "user", "content": "你好，我最喜欢吃冰淇淋了"}],},
# #     {"configurable": {"thread_id": "1"}})

# result2 = agent.invoke(
#     {"messages": [{"role": "user", "content": "我要成为galgame大神"}],},
#     {"configurable": {"thread_id": "1"}})

# for i, msg in enumerate(result2["messages"]):
#     print(f"--- 消息 {i + 1} ---")
#     if isinstance(msg, dict):
#         for key, value in msg.items():
#             print(f"{key}: {value}")
#     else:
#         print(msg)
#     print()  # 空行分隔

config = {"configurable": {"thread_id": "1"}}

# 使用checkpointer的get_tuple()方法
checkpoint_tuple = checkpointer.get_tuple(config)

if checkpoint_tuple:
    # 从checkpoint中提取messages
    messages = checkpoint_tuple.checkpoint['channel_values']['messages']
    
    print(f"总共 {len(messages)} 条消息:\n")
    for i, msg in enumerate(messages):
        print(f"{i} {msg.type}:\n{msg.content}\n")

checkpointer.delete_thread(thread_id="1")