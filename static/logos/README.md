# Provider Logos

此目录存放供应商模板的 logo 图片。

## 文件列表

- `openai.png` - OpenAI logo
- `anthropic.png` - Anthropic logo
- `google.png` - Google logo
- `tongyi.png` - 通义千问 logo
- `local.png` - 本地模型 logo

## 使用说明

1. Logo 文件名必须与 Provider 的 `provider_id` 一致
2. 推荐尺寸：256x256 或 512x512
3. 格式：PNG（支持透明背景）
4. 路径会自动在 Provider 元数据中定义为 `/static/logos/{provider_id}.png`
