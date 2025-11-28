"""消息管理路由"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Form
from fastapi.responses import StreamingResponse
from api.schemas import (
    ResponseModel, MessageRequest, MessageResponse, ConversationHistoryResponse,
    TextToSpeechRequest, CacheInfoResponse, ClearCacheRequest
)
from core import AppStorage, AgentManager
from core.dependencies import get_storage, get_agent
import io

router = APIRouter()


@router.post("/messages", response_model=ResponseModel)
async def send_message(
    req: MessageRequest,
    agent_manager: AgentManager = Depends(get_agent)
):
    """发送文本消息"""
    try:
        response = agent_manager.send_message(
            user_message=req.content,
            conversation_id=req.conversation_id,
            character_id=req.character_id,
            model_id=req.model_id,
            provider_id=req.provider_id
        )
        
        return ResponseModel(
            code=200,
            message="消息发送成功",
            data={
                "message": response
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations/{conversation_id}/messages", response_model=ResponseModel)
async def get_conversation_history(
    conversation_id: int,
    from_checkpoint: bool = False,
    agent_manager: AgentManager = Depends(get_agent)
):
    """获取会话历史"""
    try:
        messages = agent_manager.get_conversation_history(
            conversation_id=conversation_id,
            from_checkpoint=from_checkpoint
        )
        return ResponseModel(
            code=200,
            message="获取成功",
            data={
                "conversation_id": conversation_id,
                "messages": messages
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/messages/audio", response_model=ResponseModel)
async def send_audio_message(
    conversation_id: int = Form(...),
    character_id: int = Form(...),
    model_id: str = Form(...),
    provider_id: str = Form(...),
    file: UploadFile = File(...),
    asr_provider: str = Form(None),
    language: str = Form(None),
    agent_manager: AgentManager = Depends(get_agent)
):
    """发送音频消息（ASR识别后返回文本响应）
    
    接收音频流，使用ASR转换为文本，然后调用LLM获取响应
    
    Form参数:
    - conversation_id: 会话ID
    - character_id: 角色ID
    - model_id: 模型ID
    - provider_id: 供应商ID
    - file: 音频文件（支持 wav, mp3, m4a 等格式）
    - asr_provider: ASR提供商（可选）
    - language: 语言代码（可选）
    
    返回:
    - transcribed_text: 识别的文本
    - assistant_response: AI助手的文本回复
    """
    try:
        audio_bytes = await file.read()
        response = await agent_manager.send_audio_message_async(
            audio=audio_bytes,
            conversation_id=conversation_id,
            character_id=character_id,
            model_id=model_id,
            provider_id=provider_id,
            asr_provider=asr_provider,
            language=language
        )
        
        # 获取识别的文本（从最后一条用户消息）
        messages = agent_manager.get_conversation_history(conversation_id, from_checkpoint=False)
        transcribed_text = messages[-2]["content"] if len(messages) >= 2 else ""
        
        return ResponseModel(
            code=200,
            message="音频消息发送成功",
            data={
                "transcribed_text": transcribed_text,
                "assistant_response": response
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tts/synthesize", response_model=ResponseModel)
async def text_to_speech(
    req: TextToSpeechRequest,
    agent_manager: AgentManager = Depends(get_agent)
):
    """文本转语音"""
    try:
        audio_bytes = agent_manager.text_to_speech(
            text=req.text,
            tts_provider=req.tts_provider,
            language=req.language
        )
        return ResponseModel(
            code=200,
            message="转换成功",
            data={
                "audio_bytes_length": len(audio_bytes),
                "note": "返回的是二进制音频数据"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cache/info", response_model=ResponseModel)
async def get_cache_info(agent_manager: AgentManager = Depends(get_agent)):
    """获取缓存信息"""
    try:
        cache_info = agent_manager.get_cache_info()
        return ResponseModel(
            code=200,
            message="获取成功",
            data=cache_info
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cache/clear", response_model=ResponseModel)
async def clear_cache(
    req: ClearCacheRequest,
    agent_manager: AgentManager = Depends(get_agent)
):
    """清空Agent缓存"""
    try:
        count = agent_manager.clear_agent_cache(req.character_id)
        return ResponseModel(
            code=200,
            message="清空成功",
            data={"cleared_count": count}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
