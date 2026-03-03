#!/usr/bin/env node
/**
 * 自动修复缺失的 useLanguage 导入
 * 
 * 检测使用了 t() 函数但没有导入 useLanguage 的文件，并自动添加导入
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
    componentsDir: path.join(__dirname, '../components'),
    pagesDir: path.join(__dirname, '../pages'),
    extensions: ['.tsx', '.ts'],
    excludeDirs: ['node_modules', 'dist', '.git'],
};

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

function usesTranslationFunction(content: string): boolean {
    // 检查是否使用了 t() 函数
    return /\bt\s*\(['"]/g.test(content);
}

function hasUseLanguageImport(content: string): boolean {
    // 检查是否已经导入了 useLanguage
    return /import\s+{[^}]*useLanguage[^}]*}\s+from\s+['"].*LanguageContext['"]/g.test(content);
}

function hasUseLanguageHook(content: string): boolean {
    // 检查是否已经使用了 useLanguage hook
    return /const\s+{[^}]*\bt\b[^}]*}\s*=\s*useLanguage\(\)/g.test(content);
}

function addUseLanguageImport(content: string, filePath: string): string {
    // 计算相对路径深度
    const relativePath = path.relative(CONFIG.componentsDir, filePath);
    const depth = relativePath.split(path.sep).length - 1;
    const importPath = '../'.repeat(depth) + 'contexts/LanguageContext';

    // 找到最后一个 import 语句的位置
    const importRegex = /import\s+.*?from\s+['"].*?['"];?\s*\n/g;
    const imports = content.match(importRegex);

    if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const insertPosition = lastImportIndex + lastImport.length;

        const newImport = `import { useLanguage } from '${importPath}';\n`;
        return content.slice(0, insertPosition) + newImport + content.slice(insertPosition);
    }

    return content;
}

function addUseLanguageHook(content: string): string {
    // 找到组件函数的开始位置
    const componentRegex = /(?:export\s+)?(?:const|function)\s+\w+[^{]*{\s*\n/;
    const match = content.match(componentRegex);

    if (match) {
        const insertPosition = match.index! + match[0].length;
        const indent = '  '; // 假设使用 2 空格缩进
        const hookLine = `${indent}const { t } = useLanguage();\n`;

        return content.slice(0, insertPosition) + hookLine + content.slice(insertPosition);
    }

    return content;
}

async function main() {
    console.log('🔍 开始检测缺失的 useLanguage 导入...\n');

    const files = [
        ...getAllFiles(CONFIG.componentsDir),
        ...getAllFiles(CONFIG.pagesDir),
    ];

    let fixedCount = 0;
    const filesToFix: string[] = [];

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');

        // 检查是否使用了 t() 但没有导入 useLanguage
        if (usesTranslationFunction(content)) {
            const hasImport = hasUseLanguageImport(content);
            const hasHook = hasUseLanguageHook(content);

            if (!hasImport || !hasHook) {
                filesToFix.push(file);
                console.log(`⚠️  ${path.relative(process.cwd(), file)}`);
                if (!hasImport) console.log('   - 缺少 useLanguage 导入');
                if (!hasHook) console.log('   - 缺少 useLanguage hook 调用');
            }
        }
    }

    if (filesToFix.length === 0) {
        console.log('✅ 所有文件都正确导入了 useLanguage！\n');
        return;
    }

    console.log(`\n📝 发现 ${filesToFix.length} 个文件需要修复\n`);
    console.log('⚠️  注意：此脚本仅用于检测，不会自动修复文件');
    console.log('   请手动添加以下内容：');
    console.log('   1. import { useLanguage } from \'@/contexts/LanguageContext\';');
    console.log('   2. const { t } = useLanguage(); // 在组件函数内\n');
}

main().catch(error => {
    console.error('❌ 检测过程出错:', error.message);
    process.exit(1);
});
