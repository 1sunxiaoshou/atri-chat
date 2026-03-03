#!/usr/bin/env node
/**
 * 国际化翻译键检测脚本
 * 
 * 功能：
 * 1. 检测代码中使用的翻译键是否都在 JSON 文件中定义
 * 2. 检测是否有 t('key') || '默认值' 的错误用法
 * 3. 检测是否有硬编码的中文文本
 * 4. 检测 JSON 文件中未使用的翻译键
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const CONFIG = {
    localesDir: path.join(__dirname, '../locales'),
    componentsDir: path.join(__dirname, '../components'),
    pagesDir: path.join(__dirname, '../pages'),
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    excludeDirs: ['node_modules', 'dist', '.git'],
};

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// 读取翻译文件
function loadTranslations(locale: string): Record<string, any> {
    const filePath = path.join(CONFIG.localesDir, `${locale}.json`);
    if (!fs.existsSync(filePath)) {
        log(`⚠️  翻译文件不存在: ${filePath}`, 'yellow');
        return {};
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// 扁平化翻译键
function flattenKeys(obj: Record<string, any>, prefix = ''): Set<string> {
    const keys = new Set<string>();
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            flattenKeys(value, fullKey).forEach(k => keys.add(k));
        } else {
            keys.add(fullKey);
        }
    }
    return keys;
}

// 递归获取所有文件
function getAllFiles(dir: string, fileList: string[] = []): string[] {
    if (!fs.existsSync(dir)) return fileList;

    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (!CONFIG.excludeDirs.includes(file)) {
                getAllFiles(filePath, fileList);
            }
        } else if (CONFIG.extensions.some(ext => file.endsWith(ext))) {
            fileList.push(filePath);
        }
    });

    return fileList;
}

// 提取代码中使用的翻译键
function extractUsedKeys(content: string): Set<string> {
    const keys = new Set<string>();

    // 匹配 t('key') 或 t("key")
    const regex = /\bt\s*\(\s*['"]([^'"]+)['"]/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
        keys.add(match[1]);
    }

    return keys;
}

// 检测错误用法: t('key') || '默认值'
function checkBadPatterns(filePath: string, content: string): string[] {
    const errors: string[] = [];
    const lines = content.split('\n');

    // 检测 t('key') || 'default'
    const badPattern = /\bt\s*\([^)]+\)\s*\|\|/g;
    lines.forEach((line, index) => {
        if (badPattern.test(line)) {
            errors.push(`${filePath}:${index + 1} - 错误用法: t('key') || '默认值'`);
        }
    });

    return errors;
}

// 检测硬编码中文
function checkHardcodedChinese(filePath: string, content: string): string[] {
    const errors: string[] = [];
    const lines = content.split('\n');

    // 匹配字符串中的中文字符（排除注释）
    const chineseInStringRegex = /(['"`])([^'"`]*[\u4e00-\u9fff]+[^'"`]*)\1/g;

    lines.forEach((line, index) => {
        // 跳过注释行
        if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('/*')) {
            return;
        }

        let match;
        while ((match = chineseInStringRegex.exec(line)) !== null) {
            const chineseText = match[2];
            // 排除一些特殊情况（如 placeholder 中的示例文本）
            if (chineseText.length > 1 && !line.includes('placeholder=')) {
                errors.push(`${filePath}:${index + 1} - 硬编码中文: "${chineseText}"`);
            }
        }
    });

    return errors;
}

// 主函数
async function main() {
    log('\n🔍 开始检测国际化翻译键...\n', 'cyan');

    // 1. 加载翻译文件
    log('📚 加载翻译文件...', 'blue');
    const zhTranslations = loadTranslations('zh');
    const enTranslations = loadTranslations('en');

    const zhKeys = flattenKeys(zhTranslations);
    const enKeys = flattenKeys(enTranslations);

    log(`  ✓ 中文翻译键: ${zhKeys.size} 个`, 'green');
    log(`  ✓ 英文翻译键: ${enKeys.size} 个\n`, 'green');

    // 2. 检查中英文翻译键是否一致
    log('🔄 检查中英文翻译键一致性...', 'blue');
    const missingInEn = [...zhKeys].filter(k => !enKeys.has(k));
    const missingInZh = [...enKeys].filter(k => !zhKeys.has(k));

    if (missingInEn.length > 0) {
        log(`  ⚠️  英文翻译中缺失的键 (${missingInEn.length} 个):`, 'yellow');
        missingInEn.forEach(key => log(`    - ${key}`, 'yellow'));
    }

    if (missingInZh.length > 0) {
        log(`  ⚠️  中文翻译中缺失的键 (${missingInZh.length} 个):`, 'yellow');
        missingInZh.forEach(key => log(`    - ${key}`, 'yellow'));
    }

    if (missingInEn.length === 0 && missingInZh.length === 0) {
        log('  ✓ 中英文翻译键完全一致\n', 'green');
    } else {
        log('');
    }

    // 3. 扫描代码文件
    log('📂 扫描代码文件...', 'blue');
    const files = [
        ...getAllFiles(CONFIG.componentsDir),
        ...getAllFiles(CONFIG.pagesDir),
    ];
    log(`  ✓ 找到 ${files.length} 个文件\n`, 'green');

    // 4. 提取使用的翻译键
    log('🔎 提取使用的翻译键...', 'blue');
    const usedKeys = new Set<string>();
    const badPatternErrors: string[] = [];
    const hardcodedChineseErrors: string[] = [];

    files.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8');

        // 提取翻译键
        extractUsedKeys(content).forEach(key => usedKeys.add(key));

        // 检测错误用法
        badPatternErrors.push(...checkBadPatterns(file, content));

        // 检测硬编码中文
        hardcodedChineseErrors.push(...checkHardcodedChinese(file, content));
    });

    log(`  ✓ 代码中使用了 ${usedKeys.size} 个翻译键\n`, 'green');

    // 5. 检查未定义的翻译键
    log('❌ 检查未定义的翻译键...', 'blue');
    const undefinedKeys = [...usedKeys].filter(k => !zhKeys.has(k));

    if (undefinedKeys.length > 0) {
        log(`  ⚠️  未定义的翻译键 (${undefinedKeys.length} 个):`, 'red');
        undefinedKeys.forEach(key => log(`    - ${key}`, 'red'));
        log('');
    } else {
        log('  ✓ 所有翻译键都已定义\n', 'green');
    }

    // 6. 检查未使用的翻译键
    log('🗑️  检查未使用的翻译键...', 'blue');
    const unusedKeys = [...zhKeys].filter(k => !usedKeys.has(k));

    if (unusedKeys.length > 0) {
        log(`  ℹ️  未使用的翻译键 (${unusedKeys.length} 个):`, 'cyan');
        unusedKeys.forEach(key => log(`    - ${key}`, 'cyan'));
        log('');
    } else {
        log('  ✓ 所有翻译键都在使用中\n', 'green');
    }

    // 7. 检查错误用法
    log('⚠️  检查错误用法 t(\'key\') || \'默认值\'...', 'blue');
    if (badPatternErrors.length > 0) {
        log(`  ❌ 发现 ${badPatternErrors.length} 处错误用法:`, 'red');
        badPatternErrors.forEach(error => log(`    ${error}`, 'red'));
        log('');
    } else {
        log('  ✓ 未发现错误用法\n', 'green');
    }

    // 8. 检查硬编码中文
    log('🈲 检查硬编码中文...', 'blue');
    if (hardcodedChineseErrors.length > 0) {
        log(`  ⚠️  发现 ${hardcodedChineseErrors.length} 处硬编码中文:`, 'yellow');
        hardcodedChineseErrors.slice(0, 20).forEach(error => log(`    ${error}`, 'yellow'));
        if (hardcodedChineseErrors.length > 20) {
            log(`    ... 还有 ${hardcodedChineseErrors.length - 20} 处`, 'yellow');
        }
        log('');
    } else {
        log('  ✓ 未发现硬编码中文\n', 'green');
    }

    // 9. 总结
    log('📊 检测总结:', 'cyan');
    log('─'.repeat(50), 'cyan');

    const hasErrors = undefinedKeys.length > 0 ||
        badPatternErrors.length > 0 ||
        missingInEn.length > 0 ||
        missingInZh.length > 0;

    const hasWarnings = hardcodedChineseErrors.length > 0 || unusedKeys.length > 0;

    if (!hasErrors && !hasWarnings) {
        log('✅ 所有检查通过！国际化配置完美！', 'green');
    } else {
        if (hasErrors) {
            log('❌ 发现错误，需要修复！', 'red');
        }
        if (hasWarnings) {
            log('⚠️  发现警告，建议优化', 'yellow');
        }
    }

    log('─'.repeat(50) + '\n', 'cyan');

    // 返回退出码
    process.exit(hasErrors ? 1 : 0);
}

main().catch(error => {
    log(`\n❌ 检测过程出错: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
});
