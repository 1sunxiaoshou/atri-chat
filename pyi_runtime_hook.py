import sys
import os

# PyInstaller Runtime Hook: 处理无控制台环境下的标准输出流问题
# 当以 --windowed 或 console=False 打包时，sys.stdout/stderr/stdin 可能为 None
# 这会导致 uvicorn, loguru 或普通的 print 调用报 'NoneType' object has no attribute 'isatty' 或 'write'

def bootstrap_runtime():
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w")
    if sys.stdin is None:
        sys.stdin = open(os.devnull, "r")

bootstrap_runtime()
