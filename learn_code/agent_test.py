import os
from pprint import pprint
from dotenv import load_dotenv

project_root = os.path.dirname(os.path.abspath(__file__))
os.chdir(project_root)
load_dotenv()

from langchain_community.chat_models.tongyi import ChatTongyi
from langchain.agents import create_agent
from langchain.agents.middleware import wrap_model_call, ModelRequest, ModelResponse

basic_model = ChatTongyi(model=os.getenv("MODEL"))
advanced_model = ChatTongyi(model="qwen3-30b-a3b-instruct-2507")

# 使用类来追踪可变状态
class MessageCounter:
    def __init__(self):
        self.count = 0
    
    def increment(self):
        self.count += 1
    
    def should_use_advanced(self):
        return self.count > 0

counter = MessageCounter()

@wrap_model_call
def dynamic_model_selection(request: ModelRequest, handler) -> ModelResponse:
    """根据对话复杂度选择模型"""
    if counter.should_use_advanced():
        # 对于较长的对话使用高级模型
        model = advanced_model
        counter.increment()
        return handler(request.override(model=model))
    else:
        counter.increment()
        return handler(request)

agent = create_agent(
    model=basic_model,  # 默认模型
    system_prompt="你是一个AI助手",
    middleware=[dynamic_model_selection]
)

response1 = agent.invoke({"input": "你好，你最喜欢的是什么啊？"})
pprint(response1)
print(f"response1之后的消息计数: {counter.count}")

response2 = agent.invoke({"input": "刚刚说的是真的吗？"})
pprint(response2)
print(f"response2之后的消息计数: {counter.count}")