# VRM 动画文件

## 当前可用动画

### 1. idle.vrma
- **来源**: lobe-vidol (idle_loop.vrma)
- **用途**: 闲置动画/默认站立姿态
- **循环**: 是
- **状态**: ✅ 已配置

## 添加更多动画

如果需要添加更多动画，可以：

1. **从 lobe-vidol 下载**
   - 访问: https://github.com/lobehub/lobe-vidol/tree/main/public
   - 下载 `.vrma` 文件到此目录

2. **使用在线资源**
   - 编辑 `frontend/libs/emoteController/motionController.ts`
   - 取消注释其他动画配置
   - 将 URL 改为在线资源地址

3. **自己制作**
   - 使用 VRoid Studio 或 Blender
   - 导出为 `.vrma` 格式
   - 放到此目录

## 文件命名规范

- `idle.vrma` - 闲置动画
- `wave.vrma` - 挥手
- `bow.vrma` - 鞠躬
- `clap.vrma` - 鼓掌
- `happy.vrma` - 开心
- `sad.vrma` - 悲伤
- `thinking.vrma` - 思考
- `dance.vrma` - 跳舞

## 注意事项

- 文件大小建议控制在 500KB 以内
- 确保动画与 VRM 模型兼容
- 循环动画建议时长 3-5 秒
- 单次动画建议时长 2-3 秒
