# 国际化检测脚本使用说明

## 功能介绍

`check-i18n.ts` 是一个用于检测前端国际化配置的脚本，可以帮助你：

1. ✅ 检测代码中使用的翻译键是否都在 JSON 文件中定义
2. ✅ 检测是否有 `t('key') || '默认值'` 的错误用法
3. ✅ 检测是否有硬编码的中文文本
4. ✅ 检测 JSON 文件中未使用的翻译键
5. ✅ 检查中英文翻译键是否一致

## 使用方法

### 在项目根目录运行

```bash
cd frontend
npm run check-i18n
```

### 或者直接运行脚本

```bash
cd frontend
npx tsx scripts/check-i18n.ts
```

## 输出说明

### 1. 翻译文件加载

```
📚 加载翻译文件...
  ✓ 中文翻译键: 153 个
  ✓ 英文翻译键: 153 个
```

显示加载的翻译键数量。

### 2. 中英文一致性检查

```
🔄 检查中英文翻译键一致性...
  ✓ 中英文翻译键完全一致
```

或者显示缺失的键：

```
  ⚠️  英文翻译中缺失的键 (2 个):
    - admin.newKey
    - chat.anotherKey
```

### 3. 未定义的翻译键

```
❌ 检查未定义的翻译键...
  ⚠️  未定义的翻译键 (1 个):
    - admin.confirmDeleteVRM
```

**这是错误！** 需要在 `locales/zh.json` 和 `locales/en.json` 中添加这些键。

### 4. 未使用的翻译键

```
🗑️  检查未使用的翻译键...
  ℹ️  未使用的翻译键 (30 个):
    - sidebar.characterHistory
    - settings.general
```

**这是提示信息。** 这些键已定义但代码中未使用，可以考虑删除或保留备用。

### 5. 错误用法检查

```
⚠️  检查错误用法 t('key') || '默认值'...
  ✓ 未发现错误用法
```

或者显示错误：

```
  ❌ 发现 3 处错误用法:
    components/Example.tsx:42 - 错误用法: t('key') || '默认值'
```

**这是错误！** 需要移除 `|| '默认值'` 部分，直接使用 `t('key')`。

### 6. 硬编码中文检查

```
🈲 检查硬编码中文...
  ⚠️  发现 215 处硬编码中文:
    components/admin/AdminDashboard.tsx:49 - 硬编码中文: "刷新VRM模型数据"
```

**这是警告。** 建议将这些硬编码文本替换为翻译键。

## 退出码

- `0` - 检查通过（可能有警告）
- `1` - 发现错误（未定义的键、错误用法、中英文不一致）

## 配置

可以在脚本中修改 `CONFIG` 对象来调整检测范围：

```typescript
const CONFIG = {
  localesDir: path.join(__dirname, '../locales'),
  componentsDir: path.join(__dirname, '../components'),
  pagesDir: path.join(__dirname, '../pages'),
  extensions: ['.tsx', '.ts', '.jsx', '.js'],
  excludeDirs: ['node_modules', 'dist', '.git'],
};
```

## 常见问题

### Q: 为什么会有未使用的翻译键？

A: 可能的原因：
1. 旧代码遗留，已经不再使用
2. 预留的翻译键，计划未来使用
3. 某些动态场景下使用，脚本无法检测到

### Q: 如何处理硬编码中文？

A: 步骤：
1. 在 `locales/zh.json` 和 `locales/en.json` 中添加翻译键
2. 在代码中使用 `t('key')` 替换硬编码文本
3. 重新运行检测脚本验证

### Q: 脚本检测不到某些翻译键使用？

A: 脚本使用正则表达式匹配 `t('key')` 模式，以下情况可能检测不到：
- 动态键：`t(dynamicKey)` ❌
- 模板字符串：`` t(`${prefix}.key`) `` ❌
- 变量传递：`const key = 'admin.name'; t(key)` ❌

这些都是不推荐的用法，应该避免。

## 集成到 CI/CD

可以在 CI/CD 流程中添加检测步骤：

```yaml
# .github/workflows/ci.yml
- name: Check i18n
  run: |
    cd frontend
    npm run check-i18n
```

如果检测失败（退出码为 1），CI 会自动失败。
