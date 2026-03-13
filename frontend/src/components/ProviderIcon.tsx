import { ProviderIcon as LobeProviderIcon } from '@lobehub/icons';
import React from 'react';

interface ProviderIconProps {
    providerType: string;  // 使用 provider_type
    size?: number;
    className?: string;
}

/**
 * 供应商图标组件
 * 使用 @lobehub/icons 的官方 ProviderIcon 组件
 * 根据 provider_type 自动显示对应的品牌图标
 */
export const ProviderIcon: React.FC<ProviderIconProps> = ({
    providerType,
    size = 24,
    className = ''
}) => {
    return (
        <LobeProviderIcon
            provider={providerType}
            size={size}
            type="color"
            className={className}
        />
    );
};
