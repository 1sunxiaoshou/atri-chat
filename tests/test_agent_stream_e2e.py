import os
from pathlib import Path
import sys

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from tests.agent_stream_e2e import run_e2e


@pytest.mark.integration
def test_agent_stream_e2e_qwen():
    if not os.environ.get("QWEN_API_KEY"):
        pytest.skip("需要设置环境变量 QWEN_API_KEY 才执行真实 Qwen 端到端测试。")

    exit_code = run_e2e(
        prompt="请用一句话回复：流式测试正常。",
        model_id=os.environ.get("ATRI_E2E_MODEL_ID", "qwen3.5-flash"),
        character_id=os.environ.get("ATRI_E2E_CHARACTER_ID"),
        verbose=False,
    )

    assert exit_code == 0
