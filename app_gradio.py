"""Gradio 前端界面"""
import gradio as gr
import requests
from typing import List, Dict, Optional, Tuple
import json

# API 基础 URL
API_BASE_URL = "http://localhost:8000/api/v1"


# ==================== API 调用函数 ====================

def api_request(method: str, endpoint: str, **kwargs) -> Dict:
    """统一的 API 请求函数"""
    url = f"{API_BASE_URL}{endpoint}"
    try:
        response = requests.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {"code": 500, "message": f"请求失败: {str(e)}", "data": None}


# ==================== 角色管理 ====================

def get_characters() -> List[Tuple[str, int]]:
    """获取角色列表"""
    result = api_request("GET", "/characters")
    if result["code"] == 200 and result["data"]:
        return [(f"{c['name']} (ID: {c['character_id']})", c['character_id']) 
                for c in result["data"]]
    return []


def create_character(name: str, description: str, system_prompt: str, 
                     model_id: str, provider_id: str, tts_id: str) -> str:
    """创建角色"""
    data = {
        "name": name,
        "description": description,
        "system_prompt": system_prompt,
        "primary_model_id": model_id,
        "primary_provider_id": provider_id,
        "tts_id": tts_id,
        "enabled": True
    }
    result = api_request("POST", "/characters", json=data)
    if result["code"] == 200:
        return f"✅ 角色创建成功！ID: {result['data']['character_id']}"
    return f"❌ 创建失败: {result['message']}"


# ==================== 会话管理 ====================

def get_conversations(character_id: Optional[int] = None) -> List[Tuple[str, int]]:
    """获取会话列表"""
    params = {"character_id": character_id} if character_id else {}
    result = api_request("GET", "/conversations", params=params)
    if result["code"] == 200 and result["data"]:
        return [(f"{c['title']} (ID: {c['conversation_id']})", c['conversation_id']) 
                for c in result["data"]]
    return []


def create_conversation(character_id: int, title: str) -> str:
    """创建会话"""
    data = {"character_id": character_id, "title": title}
    result = api_request("POST", "/conversations", json=data)
    if result["code"] == 200:
        return f"✅ 会话创建成功！ID: {result['data']['conversation_id']}"
    return f"❌ 创建失败: {result['message']}"


def get_conversation_history(conversation_id: int) -> List[Tuple[str, str]]:
    """获取会话历史"""
    result = api_request("GET", f"/conversations/{conversation_id}/history")
    if result["code"] == 200 and result["data"]:
        messages = result["data"]["messages"]
        history = []
        for msg in messages:
            if msg["message_type"] == "user":
                history.append((msg["content"], None))
            else:
                history.append((None, msg["content"]))
        return history
    return []


# ==================== 消息发送 ====================

def send_message(conversation_id: int, character_id: int, 
                model_id: str, provider_id: str, message: str, 
                history: List) -> Tuple[List, str]:
    """发送消息"""
    if not message.strip():
        return history, ""
    
    data = {
        "conversation_id": conversation_id,
        "character_id": character_id,
        "model_id": model_id,
        "provider_id": provider_id,
        "content": message
    }
    
    result = api_request("POST", "/messages/send", json=data)
    
    if result["code"] == 200:
        history.append((message, result["data"]["response"]))
        return history, ""
    else:
        history.append((message, f"❌ 错误: {result['message']}"))
        return history, ""


# ==================== 配置管理 ====================

def create_provider(provider_id: str, config_json: str) -> str:
    """创建供应商"""
    try:
        config = json.loads(config_json)
        data = {"provider_id": provider_id, "config_json": config}
        result = api_request("POST", "/providers", json=data)
        if result["code"] == 200:
            return f"✅ 供应商创建成功！"
        return f"❌ 创建失败: {result['message']}"
    except json.JSONDecodeError:
        return "❌ 配置 JSON 格式错误"


def create_model(provider_id: str, model_id: str, model_type: str, mode: str) -> str:
    """创建模型"""
    data = {
        "provider_id": provider_id,
        "model_id": model_id,
        "model_type": model_type,
        "mode": mode,
        "enabled": True
    }
    result = api_request("POST", "/models", json=data)
    if result["code"] == 200:
        return f"✅ 模型创建成功！"
    return f"❌ 创建失败: {result['message']}"


def create_tts(tts_id: str, provider_id: str, voice_role: str, 
               api_key: str, access_url: str) -> str:
    """创建 TTS"""
    data = {
        "tts_id": tts_id,
        "provider_id": provider_id,
        "voice_role": voice_role,
        "api_key": api_key if api_key else None,
        "access_url": access_url if access_url else None,
        "enabled": True
    }
    result = api_request("POST", "/tts", json=data)
    if result["code"] == 200:
        return f"✅ TTS 创建成功！"
    return f"❌ 创建失败: {result['message']}"



# ==================== Gradio 界面 ====================

def build_ui():
    """构建 Gradio 界面"""
    
    with gr.Blocks(title="AI Agent 聊天系统") as demo:
        gr.Markdown("# 🤖 AI Agent 多角色聊天系统")
        
        with gr.Tabs():
            # ==================== 聊天界面 ====================
            with gr.Tab("💬 聊天"):
                with gr.Row():
                    with gr.Column(scale=1):
                        character_dropdown = gr.Dropdown(
                            label="选择角色",
                            choices=get_characters(),
                            interactive=True
                        )
                        conversation_dropdown = gr.Dropdown(
                            label="选择会话",
                            choices=[],
                            interactive=True
                        )
                        
                        with gr.Group():
                            gr.Markdown("### 新建会话")
                            new_conv_title = gr.Textbox(label="会话标题", placeholder="输入会话标题")
                            create_conv_btn = gr.Button("创建会话", variant="primary")
                            conv_status = gr.Textbox(label="状态", interactive=False)
                        
                        with gr.Group():
                            gr.Markdown("### 模型配置")
                            model_id = gr.Textbox(label="模型 ID", value="gpt-4")
                            provider_id = gr.Textbox(label="供应商 ID", value="openai")
                    
                    with gr.Column(scale=2):
                        chatbot = gr.Chatbot(label="对话", height=500)
                        msg_input = gr.Textbox(
                            label="输入消息",
                            placeholder="输入你的消息...",
                            lines=3
                        )
                        with gr.Row():
                            send_btn = gr.Button("发送", variant="primary")
                            clear_btn = gr.Button("清空")
                            load_history_btn = gr.Button("加载历史")
                
                # 事件处理
                def update_conversations(character_id):
                    if character_id:
                        convs = get_conversations(character_id)
                        return gr.Dropdown(choices=convs)
                    return gr.Dropdown(choices=[])
                
                character_dropdown.change(
                    update_conversations,
                    inputs=[character_dropdown],
                    outputs=[conversation_dropdown]
                )
                
                def create_conv_handler(character_id, title):
                    if not character_id or not title:
                        return "❌ 请选择角色并输入标题", gr.Dropdown(choices=[])
                    status = create_conversation(character_id, title)
                    convs = get_conversations(character_id)
                    return status, gr.Dropdown(choices=convs)
                
                create_conv_btn.click(
                    create_conv_handler,
                    inputs=[character_dropdown, new_conv_title],
                    outputs=[conv_status, conversation_dropdown]
                )
                
                def send_handler(conv_id, char_id, model, provider, message, history):
                    if not conv_id or not char_id:
                        return history, message
                    return send_message(conv_id, char_id, model, provider, message, history)
                
                send_btn.click(
                    send_handler,
                    inputs=[conversation_dropdown, character_dropdown, model_id, 
                           provider_id, msg_input, chatbot],
                    outputs=[chatbot, msg_input]
                )
                
                msg_input.submit(
                    send_handler,
                    inputs=[conversation_dropdown, character_dropdown, model_id, 
                           provider_id, msg_input, chatbot],
                    outputs=[chatbot, msg_input]
                )
                
                clear_btn.click(lambda: [], outputs=[chatbot])
                
                def load_history_handler(conv_id):
                    if not conv_id:
                        return []
                    return get_conversation_history(conv_id)
                
                load_history_btn.click(
                    load_history_handler,
                    inputs=[conversation_dropdown],
                    outputs=[chatbot]
                )

            
            # ==================== 角色管理 ====================
            with gr.Tab("👤 角色管理"):
                with gr.Row():
                    with gr.Column():
                        gr.Markdown("### 创建新角色")
                        char_name = gr.Textbox(label="角色名称", placeholder="例如：小助手")
                        char_desc = gr.Textbox(label="角色描述", placeholder="角色的简短描述")
                        char_prompt = gr.Textbox(
                            label="系统提示词",
                            placeholder="你是一个友好、专业的AI助手...",
                            lines=5
                        )
                        char_model = gr.Textbox(label="主模型 ID", value="gpt-4")
                        char_provider = gr.Textbox(label="主供应商 ID", value="openai")
                        char_tts = gr.Textbox(label="TTS ID", value="default-tts")
                        create_char_btn = gr.Button("创建角色", variant="primary")
                        char_status = gr.Textbox(label="状态", interactive=False)
                    
                    with gr.Column():
                        gr.Markdown("### 现有角色")
                        refresh_char_btn = gr.Button("刷新列表")
                        char_list = gr.Dataframe(
                            headers=["ID", "名称", "描述", "模型", "供应商"],
                            interactive=False
                        )
                
                def create_char_handler(name, desc, prompt, model, provider, tts):
                    if not all([name, desc, prompt, model, provider, tts]):
                        return "❌ 请填写所有字段"
                    return create_character(name, desc, prompt, model, provider, tts)
                
                create_char_btn.click(
                    create_char_handler,
                    inputs=[char_name, char_desc, char_prompt, char_model, 
                           char_provider, char_tts],
                    outputs=[char_status]
                )
                
                def refresh_characters():
                    result = api_request("GET", "/characters")
                    if result["code"] == 200 and result["data"]:
                        data = [[c["character_id"], c["name"], c["description"], 
                                c["primary_model_id"], c["primary_provider_id"]] 
                               for c in result["data"]]
                        return data
                    return []
                
                refresh_char_btn.click(refresh_characters, outputs=[char_list])
            
            # ==================== 配置管理 ====================
            with gr.Tab("⚙️ 配置管理"):
                with gr.Tabs():
                    # 供应商配置
                    with gr.Tab("供应商"):
                        prov_id = gr.Textbox(label="供应商 ID", placeholder="例如：openai")
                        prov_config = gr.Textbox(
                            label="配置 JSON",
                            placeholder='{"api_key": "sk-xxx", "base_url": "https://api.openai.com/v1"}',
                            lines=5
                        )
                        create_prov_btn = gr.Button("创建供应商", variant="primary")
                        prov_status = gr.Textbox(label="状态", interactive=False)
                        
                        create_prov_btn.click(
                            create_provider,
                            inputs=[prov_id, prov_config],
                            outputs=[prov_status]
                        )
                    
                    # 模型配置
                    with gr.Tab("模型"):
                        mod_provider = gr.Textbox(label="供应商 ID", placeholder="openai")
                        mod_id = gr.Textbox(label="模型 ID", placeholder="gpt-4")
                        mod_type = gr.Dropdown(
                            label="模型类型",
                            choices=["text", "embedding"],
                            value="text"
                        )
                        mod_mode = gr.Textbox(label="模式", value="chat")
                        create_mod_btn = gr.Button("创建模型", variant="primary")
                        mod_status = gr.Textbox(label="状态", interactive=False)
                        
                        create_mod_btn.click(
                            create_model,
                            inputs=[mod_provider, mod_id, mod_type, mod_mode],
                            outputs=[mod_status]
                        )
                    
                    # TTS 配置
                    with gr.Tab("TTS"):
                        tts_id_input = gr.Textbox(label="TTS ID", placeholder="default-tts")
                        tts_provider = gr.Textbox(label="供应商 ID", placeholder="gpt_sovits")
                        tts_voice = gr.Textbox(label="语音角色", placeholder="female")
                        tts_key = gr.Textbox(label="API Key (可选)", placeholder="留空如果不需要")
                        tts_url = gr.Textbox(label="访问 URL (可选)", placeholder="http://localhost:9880")
                        create_tts_btn = gr.Button("创建 TTS", variant="primary")
                        tts_status = gr.Textbox(label="状态", interactive=False)
                        
                        create_tts_btn.click(
                            create_tts,
                            inputs=[tts_id_input, tts_provider, tts_voice, tts_key, tts_url],
                            outputs=[tts_status]
                        )
            
            # ==================== 帮助文档 ====================
            with gr.Tab("📖 帮助"):
                gr.Markdown("""
                ## 使用指南
                
                ### 1. 配置系统
                1. 在"配置管理"中创建供应商（如 OpenAI）
                2. 创建模型（如 gpt-4）
                3. 创建 TTS（如果需要语音功能）
                
                ### 2. 创建角色
                1. 在"角色管理"中创建新角色
                2. 设置角色名称、描述和系统提示词
                3. 选择使用的模型和供应商
                
                ### 3. 开始聊天
                1. 在"聊天"界面选择角色
                2. 创建新会话或选择现有会话
                3. 输入消息并发送
                
                ### 快捷键
                - Enter: 发送消息
                - Shift+Enter: 换行
                
                ### 注意事项
                - 确保 FastAPI 后端服务已启动（默认端口 8000）
                - 供应商配置需要有效的 API Key
                - 会话历史会自动保存
                """)
    
    return demo


if __name__ == "__main__":
    demo = build_ui()
    demo.launch(
        server_name="0.0.0.0",
        server_port=7860,
        share=False
    )
