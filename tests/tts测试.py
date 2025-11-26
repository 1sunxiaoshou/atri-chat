import sys
import os
from pathlib import Path
from play_voice import play_audio_from_bytes

# 获取项目根目录
PROJECT_ROOT = Path(__file__).parent.parent.resolve()
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from core.tts.factory import TTSFactory

test_txt = """
《原神》是由米哈游开发的一款开放世界动作角色扮演游戏，自2020年上线以来风靡全球。玩家扮演“旅行者”，在名为提瓦特的幻想大陆上探索七国，追寻失散的亲人，并逐步揭开世界的秘密。游戏以精美的二次元画风、流畅的战斗系统、丰富的角色养成和沉浸式的剧情体验著称。每个角色拥有独特的元素属性与技能，可自由搭配组成队伍，利用元素反应策略克敌。蒙德的自由、璃月的契约、稻妻的永恒、须弥的智慧……七国文化各具特色，构建出宏大而细腻的世界观。《原神》不仅是一款游戏，更是一场跨越山海的奇幻旅程。
"""

tts = TTSFactory()

gpt_sovits = tts.create_tts()

# 合成语音（假设返回的是 WAV 格式的 bytes）
audio_bytes = gpt_sovits.synthesize(test_txt, "zh")

# 将字节加载为 AudioSegment（自动识别格式，需确保是标准 WAV/MP3 等）
# 如果你知道是 raw PCM，需要指定参数，但 GPT-SoVITS 通常返回 WAV
play_audio_from_bytes(audio_bytes)
print("播放完毕！")