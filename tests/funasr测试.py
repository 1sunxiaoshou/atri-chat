import sys
import os
from pathlib import Path

# 获取项目根目录
PROJECT_ROOT = Path(__file__).parent.parent.resolve()
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from funasr import AutoModel


model = AutoModel(
    model="./asr_models/speech_seaco_paraformer_large_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
    vad_model="./asr_models/speech_fsmn_vad_zh-cn-16k-common-pytorch",
    punc_model= "./asr_models/punc_ct-transformer_zh-cn-common-vocab272727-pytorch",
    device="cpu",
    disable_update=True,
)

# en
res = model.generate(input="./tests/【默认】就……就算这样戳我，也不会掉落道具哦！……爱丽丝又不是怪物！.wav",)

print(res)