# VRM测试指南

## 📋 测试文件说明

### 单元测试（不需要真实环境）

| 文件 | 说明 | 运行时间 |
|------|------|---------|
| `test_vrm_parser.py` | 标记解析器测试 | < 1秒 |
| `test_vrm_fixes.py` | VRM修复验证测试 | < 1秒 |
| `test_vrm_dynamic_mapping.py` | 动态动作映射测试 | < 1秒 |
| `test_vrm_complete.py` | 完整功能测试（使用Mock） | < 5秒 |

### 集成测试（需要真实环境）

| 文件 | 说明 | 前置条件 |
|------|------|---------|
| `test_vrm_e2e.py` | 端到端测试 | 数据库 + TTS服务 + 角色数据 |

### 测试运行器

| 文件 | 说明 |
|------|------|
| `run_vrm_tests.py` | 一键运行所有测试 |

---

## 🚀 快速开始

### 1. 运行所有单元测试

```bash
# Windows
python tests\run_vrm_tests.py

# Linux/Mac
python tests/run_vrm_tests.py
```

### 2. 运行单个测试

```bash
# 测试标记解析器
python tests\test_vrm_parser.py

# 测试完整功能（Mock）
python tests\test_vrm_complete.py
```

### 3. 运行端到端测试（需要真实环境）

```bash
python tests\test_vrm_e2e.py
```

**前置条件**：
- ✅ 数据库已初始化
- ✅ 至少有一个测试角色
- ✅ TTS服务已配置
- ✅ （可选）VRM模型已上传

---

## 📊 测试覆盖范围

### ✅ 已覆盖功能

#### 1. 标记解析器 (`VRMMarkupParser`)
- [x] 基本标记解析
- [x] 位置计算
- [x] 动态动作映射
- [x] 未知动作处理
- [x] 表情映射

#### 2. 标记过滤器 (`MarkupFilter`)
- [x] 标记移除
- [x] 标记检测

#### 3. 句子分割 (`AudioGenerator.split_sentences`)
- [x] 基本分割
- [x] 标记在句子中间
- [x] 无标点符号处理
- [x] 连续标记处理

#### 4. 音频生成器
- [x] 串行模式 (`AudioGenerator`)
- [x] 并行模式 (`ParallelAudioGenerator`)
- [x] 时间戳计算
- [x] 标记时间戳映射

#### 5. VRM服务 (`VRMService`)
- [x] VRM上下文创建
- [x] 动作映射获取（带缓存）
- [x] 可用动作列表
- [x] 音频段生成（串行/并行）

#### 6. 端到端集成
- [x] 完整流程测试
- [x] 性能对比测试

---

## 🔧 测试环境配置

### Mock测试（无需配置）

Mock测试使用模拟对象，不需要真实的数据库和TTS服务：

```python
# 自动使用Mock对象
from tests.test_vrm_complete import MockTTSFactory, MockAppStorage
```

### 真实环境测试

需要配置以下内容：

#### 1. 数据库
```bash
# 确保数据库文件存在
data/app.db
```

#### 2. 测试角色
```sql
-- 至少需要一个角色
INSERT INTO characters (name, system_prompt, vrm_model_id, tts_id) 
VALUES ('测试角色', '我是测试角色', 'model-001', 'default');
```

#### 3. VRM模型（可选）
```sql
-- 如果要测试VRM动作
INSERT INTO vrm_models (vrm_model_id, name, model_path) 
VALUES ('model-001', '测试模型', '/uploads/vrm_models/test.vrm');

INSERT INTO vrm_animations (animation_id, vrm_model_id, name, name_cn) 
VALUES 
  ('anim-001', 'model-001', 'wave', '打招呼'),
  ('anim-002', 'model-001', 'scratch_head', '挠头');
```

---

## 📈 性能测试

### 串行 vs 并行对比

运行性能测试：

```bash
python tests\test_vrm_e2e.py
```

**预期结果**：
- 串行模式：总耗时 ≈ 句子数 × 单句TTS时间
- 并行模式：总耗时 ≈ 最慢的那句TTS时间

**示例**（5句话，每句1秒）：
- 串行：~5秒
- 并行：~1秒
- 提升：**5倍**

---

## 🐛 调试技巧

### 1. 查看详细日志

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### 2. 单独测试某个功能

```python
# 只测试标记解析
from core.vrm.markup_parser import VRMMarkupParser

parser = VRMMarkupParser()
text = "[State:开心]你好！"
clean, markups = parser.parse(text)
print(f"纯文本: {clean}")
print(f"标记: {markups}")
```

### 3. 使用断点调试

```python
# 在测试代码中添加断点
import pdb; pdb.set_trace()
```

---

## ✅ 测试检查清单

运行测试前确认：

- [ ] Python环境已激活
- [ ] 依赖包已安装 (`uv sync`)
- [ ] 项目根目录正确
- [ ] （端到端测试）数据库已初始化
- [ ] （端到端测试）TTS服务可用

---

## 📝 添加新测试

### 1. 单元测试模板

```python
"""新功能测试"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.vrm.your_module import YourClass


def test_your_feature():
    """测试你的功能"""
    print("测试开始")
    
    # 准备测试数据
    obj = YourClass()
    
    # 执行测试
    result = obj.your_method()
    
    # 验证结果
    assert result == expected_value, f"期望{expected_value}，实际{result}"
    
    print("✓ 测试通过")


if __name__ == "__main__":
    test_your_feature()
```

### 2. 异步测试模板

```python
import asyncio

async def test_async_feature():
    """测试异步功能"""
    result = await your_async_function()
    assert result is not None
    print("✓ 异步测试通过")

if __name__ == "__main__":
    asyncio.run(test_async_feature())
```

---

## 🎯 测试最佳实践

1. **先写测试，后写代码**（TDD）
2. **每个功能至少一个测试**
3. **测试要快速**（单元测试 < 1秒）
4. **测试要独立**（不依赖其他测试）
5. **使用Mock减少依赖**
6. **清晰的测试名称**
7. **充分的断言**

---

## 📞 问题反馈

如果测试失败：

1. 查看错误信息
2. 检查环境配置
3. 查看日志输出
4. 尝试单独运行失败的测试
5. 检查代码变更

---

## 🔄 持续集成

建议在CI/CD中运行：

```yaml
# .github/workflows/test.yml
- name: Run VRM Tests
  run: |
    python tests/run_vrm_tests.py
```

---

**最后更新**: 2024-12-14
