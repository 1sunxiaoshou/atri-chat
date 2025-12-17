/**
 * API 层重构验证脚本
 * 验证以下属性：
 * - 属性 16: API 调用通过 service 层
 * - 属性 28: URL 构建统一
 * - 属性 29: API 响应处理统一
 */

import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  property: string;
  passed: boolean;
  issues: string[];
}

const results: ValidationResult[] = [];

/**
 * 递归读取目录中的所有文件
 */
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      // 跳过 node_modules 和 dist
      if (file !== 'node_modules' && file !== 'dist') {
        arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

/**
 * 属性 16: API 调用通过 service 层
 * 检查组件和 hooks 中是否直接使用 fetch
 */
function verifyProperty16(): ValidationResult {
  const issues: string[] = [];
  
  // 检查 components 目录
  const componentFiles = getAllFiles(path.join(process.cwd(), 'components'));
  // 检查 hooks 目录
  const hookFiles = getAllFiles(path.join(process.cwd(), 'hooks'));
  
  const filesToCheck = [...componentFiles, ...hookFiles];
  
  for (const file of filesToCheck) {
    const content = fs.readFileSync(file, 'utf-8');
    
    // 检查是否直接使用 fetch（排除合理的使用场景）
    const fetchMatches = content.match(/fetch\s*\(/g);
    if (fetchMatches) {
      // 检查是否是将 data URL 转换为 Blob（这是合理的）
      const isDataUrlConversion = content.includes('data:') && content.includes('blob');
      if (!isDataUrlConversion) {
        issues.push(`${file}: 直接使用 fetch，应该通过 service 层调用`);
      }
    }
    
    // 检查是否导入了 api 模块
    const hasApiImport = content.includes("from '../../services/api") || 
                        content.includes('from "../services/api');
    
    // 如果文件中有 API 调用但没有导入 api 模块，可能有问题
    if (content.includes('api.') && !hasApiImport && !content.includes('services/api')) {
      issues.push(`${file}: 使用了 api 但未从 services/api 导入`);
    }
  }
  
  return {
    property: '属性 16: API 调用通过 service 层',
    passed: issues.length === 0,
    issues
  };
}

/**
 * 属性 28: URL 构建统一
 * 检查是否所有 URL 构建都使用了统一的工具函数
 */
function verifyProperty28(): ValidationResult {
  const issues: string[] = [];
  
  // 检查 services/api 目录
  const apiFiles = getAllFiles(path.join(process.cwd(), 'services', 'api'));
  
  for (const file of apiFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    
    // 检查是否有硬编码的 localhost:8000（base.ts 除外）
    if (file.includes('base.ts')) {continue;}
    
    const hasHardcodedUrl = content.includes('localhost:8000') || 
                           content.includes("'/api/v1'");
    
    if (hasHardcodedUrl) {
      // 检查是否使用了 buildURL 或 buildUploadURL
      const usesBuildURL = content.includes('buildURL') || 
                          content.includes('buildUploadURL') ||
                          content.includes('httpClient');
      
      if (!usesBuildURL) {
        issues.push(`${file}: 包含硬编码的 URL，应该使用 buildURL 或 buildUploadURL`);
      }
    }
    
    // 检查是否有字符串拼接构建 URL
    const urlConcatPattern = /\$\{[^}]*\}\/api\//g;
    if (urlConcatPattern.test(content)) {
      issues.push(`${file}: 使用字符串拼接构建 URL，应该使用统一的 URL 构建工具`);
    }
  }
  
  return {
    property: '属性 28: URL 构建统一',
    passed: issues.length === 0,
    issues
  };
}

/**
 * 属性 29: API 响应处理统一
 * 检查是否所有 API 响应都使用了统一的处理方式
 */
function verifyProperty29(): ValidationResult {
  const issues: string[] = [];
  
  // 检查 services/api 目录
  const apiFiles = getAllFiles(path.join(process.cwd(), 'services', 'api'));
  
  for (const file of apiFiles) {
    if (file.includes('base.ts') || file.includes('index.ts')) {continue;}
    
    const content = fs.readFileSync(file, 'utf-8');
    
    // 检查是否有直接的 fetch 调用
    const hasFetch = content.includes('fetch(');
    
    if (hasFetch) {
      // 对于流式响应和文件上传，直接使用 fetch 是可以接受的
      // 但应该使用统一的 URL 构建和错误处理
      const hasUnifiedUrlBuilding = content.includes('buildURL') || 
                                    content.includes('buildUploadURL');
      
      // 检查是否有错误处理（支持两种模式）
      const hasUnifiedErrorHandling = content.includes('if (!response.ok)') &&
                                     (content.includes('code: response.status') ||
                                      content.includes('response.status'));
      
      if (!hasUnifiedUrlBuilding) {
        issues.push(`${file}: 使用 fetch 但未使用统一的 URL 构建工具`);
      }
      
      if (!hasUnifiedErrorHandling) {
        issues.push(`${file}: 使用 fetch 但未使用统一的错误处理模式`);
      }
    }
    
    // 检查是否返回 ApiResponse 类型
    const hasApiResponseReturn = content.includes('Promise<ApiResponse<');
    
    if (!hasApiResponseReturn && !file.includes('types.ts')) {
      // 某些特殊方法可能返回其他类型（如流式响应）
      const isSpecialCase = content.includes('ReadableStream') || 
                           content.includes('stream:');
      
      if (!isSpecialCase) {
        issues.push(`${file}: API 方法未返回 ApiResponse 类型`);
      }
    }
  }
  
  return {
    property: '属性 29: API 响应处理统一',
    passed: issues.length === 0,
    issues
  };
}

/**
 * 运行所有验证
 */
function runValidation() {
  console.log('开始验证 API 层重构...\n');
  
  results.push(verifyProperty16());
  results.push(verifyProperty28());
  results.push(verifyProperty29());
  
  // 输出结果
  let allPassed = true;
  
  for (const result of results) {
    const status = result.passed ? '✅ 通过' : '❌ 失败';
    console.log(`${status} - ${result.property}`);
    
    if (!result.passed) {
      allPassed = false;
      console.log('  问题：');
      result.issues.forEach(issue => {
        console.log(`    - ${issue}`);
      });
    }
    console.log('');
  }
  
  // 总结
  console.log('='.repeat(60));
  if (allPassed) {
    console.log('✅ 所有验证通过！API 层重构符合要求。');
  } else {
    console.log('❌ 部分验证失败，请修复上述问题。');
    process.exit(1);
  }
}

// 运行验证
runValidation();
