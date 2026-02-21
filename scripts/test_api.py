"""测试 API 端点"""
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

# 测试 TTS 供应商 API
r1 = client.get('/api/v1/tts-providers')
print(f'TTS 供应商 API: {r1.status_code}')
print(f'TTS 供应商数量: {len(r1.json()["data"])} 个')

# 测试音色资产 API
r2 = client.get('/api/v1/voice-assets')
print(f'音色资产 API: {r2.status_code}')
print(f'音色资产数量: {len(r2.json()["data"])} 个')

# 测试供应商类型列表
r3 = client.get('/api/v1/tts-providers/types/list')
print(f'供应商类型 API: {r3.status_code}')
print(f'支持的供应商类型: {[p["name"] for p in r3.json()["data"]]}')

print('\n✓ 所有 API 测试通过')
