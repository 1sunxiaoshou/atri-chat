# 模型管理模块

## 模块结构

```
core/models/
├── __init__.py              # 模块导出
├── config.py                # 数据模型定义
├── provider.py              # 供应商实现
└── factory.py               # 模型工厂（核心）
```

## 核心组件

### ModelFactory（推荐使用）

模型工厂是核心组件，提供以下功能：

```python
from core.models import ModelFactory

# 创建模型实例
model = factory.create_model("openai", "gpt-4", temperature=0.8)

# 获取供应商元数据
metadata = factory.get_provider_metadata("openai")
all_metadata = factory.get_all_provider_metadata()

# 检查供应商依赖
dependencies = factory.check_provider_dependencies("openai")
```

### BaseProvider

所有供应商的抽象基类，提供：
- 统一的参数合并逻辑（`_merge_params`）
- 仅合并显式提供的参数，未提供的参数由模型使用自己的默认值
- 模型创建接口

### 供应商实现

- `OpenAIProvider` - OpenAI GPT 模型
- `AnthropicProvider` - Anthropic Claude 模型
- `GoogleProvider` - Google Gemini 模型
- `TongyiProvider` - 阿里通义千问
- `LocalProvider` - 本地模型（Ollama）

## 最近优化

### 1. 参数合并逻辑优化
- 提取 `_merge_params` 方法到基类
- 仅合并显式提供的参数（kwargs > config）
- 未提供的参数由模型实例化方法使用自己的默认值
- 减少重复代码

### 2. 依赖检查功能合并
- `DependencyChecker` 功能合并到 `ModelFactory.check_provider_dependencies()`
- 删除独立的 `validator.py` 文件

### 3. 元数据管理优化
- 删除 `provider_metadata.py` 文件
- 直接使用 `ModelFactory.get_provider_metadata()` 和 `get_all_provider_metadata()`

### 4. 代码清理
- 删除所有废弃的向后兼容代码
- 简化模块结构，只保留核心功能

## 使用示例

```python
from core.models import ModelFactory

# 创建工厂
factory = ModelFactory(storage)

# 获取供应商元数据
metadata = factory.get_all_provider_metadata()
openai_meta = factory.get_provider_metadata("openai")

# 检查依赖
dependencies = factory.check_provider_dependencies("openai")

# 创建模型（参数优先级：kwargs > config > 模型默认值）
model = factory.create_model("openai", "gpt-4", temperature=0.8)
```

## 扩展供应商

要添加新的供应商：

1. 继承 `BaseProvider`
2. 实现 `metadata` 属性
3. 实现 `create_text_model` 和 `create_embedding_model`
4. 在 `ModelFactory._register_default_providers()` 中注册

```python
class CustomProvider(BaseProvider):
    @property
    def metadata(self) -> ProviderMetadata:
        return ProviderMetadata(
            provider_id="custom",
            name="Custom Provider",
            description="My custom provider",
            config_fields=[...]
        )
    
    def create_text_model(self, model_id, provider_config, **kwargs):
        config = provider_config.config_json
        merged = self._merge_params(config, **kwargs)
        # 创建模型实例
        return CustomModel(**merged)
```
