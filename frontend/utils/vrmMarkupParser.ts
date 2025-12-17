/**
 * VRM 标记解析器 (前端轻量版)
 * 用于解析带有 [State:xxx] 和 [Action:xxx] 标记的文本
 */

export interface VRMMarkup {
    type: 'state' | 'action';
    value: string;
    position: number; // 在纯文本中的索引位置
}

export interface ParsedSegment {
    text: string;           // 纯文本
    originalText: string;   // 原始文本
    markups: VRMMarkup[];   // 标记列表
}

export class VRMMarkupParser {
    /**
     * 解析文本，提取标记并返回纯文本
     */
    static parse(markedText: string): ParsedSegment {
        const regex = /\[(State|Action):([^\]]+)\]/g;
        let match;
        const markups: VRMMarkup[] = [];
        let pureText = "";
        let lastIndex = 0;

        // 遍历所有匹配
        while ((match = regex.exec(markedText)) !== null) {
            // 添加标记前的文本
            pureText += markedText.substring(lastIndex, match.index);

            // 记录标记 (位置是当前 pureText 的长度)
            const typeStr = match[1];
            const valueStr = match[2];
            if (typeStr && valueStr) {
                markups.push({
                    type: typeStr.toLowerCase() as 'state' | 'action',
                    value: valueStr,
                    position: pureText.length
                });
            }

            lastIndex = regex.lastIndex;
        }

        // 添加剩余的文本
        pureText += markedText.substring(lastIndex);

        return {
            text: pureText,
            originalText: markedText,
            markups
        };
    }
}
