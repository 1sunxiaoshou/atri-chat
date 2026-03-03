import React from 'react';
import { cn } from '../../utils/cn';

export interface RadioOption {
    label: string;
    value: string;
}

interface RadioGroupProps {
    value: string;
    onChange: (value: string) => void;
    options: RadioOption[];
    label?: string;
    required?: boolean;
    orientation?: 'horizontal' | 'vertical';
    variant?: 'default' | 'segmented';
    className?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
    value,
    onChange,
    options,
    label,
    required,
    orientation = 'horizontal',
    variant = 'default',
    className
}) => {
    const selectedIndex = options.findIndex(opt => opt.value === value);

    if (variant === 'segmented') {
        return (
            <div className={cn("space-y-1", className)}>
                {label && (
                    <label className="text-sm font-medium">
                        {label}
                        {required && <span className="text-destructive ml-1">*</span>}
                    </label>
                )}
                <div className="relative bg-muted p-1 rounded-lg flex items-center shadow-inner ring-1 ring-border/50">
                    {/* Animated Slider Background */}
                    <div
                        className="absolute top-1 bottom-1 left-1 bg-background rounded-md shadow-sm transition-all duration-300 ease-out"
                        style={{
                            width: `calc((100% - 8px) / ${options.length})`,
                            transform: `translateX(${selectedIndex * 100}%)`
                        }}
                    />

                    {/* Options */}
                    <div className={cn(
                        "grid w-full h-full relative",
                        `grid-cols-${options.length}`
                    )} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
                        {options.map((option) => {
                            const isActive = value === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => onChange(option.value)}
                                    className={cn(
                                        "relative z-10 flex items-center justify-center px-3 py-2 text-xs font-medium transition-all duration-300 rounded-md",
                                        isActive
                                            ? "text-primary scale-105"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // Default variant (card-style radio buttons)
    return (
        <div className={cn("space-y-1", className)}>
            {label && (
                <label className="text-sm font-medium">
                    {label}
                    {required && <span className="text-destructive ml-1">*</span>}
                </label>
            )}
            <div className={cn(
                "flex gap-3",
                orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'
            )}>
                {options.map((option) => {
                    const isSelected = value === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => onChange(option.value)}
                            className={cn(
                                "relative flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all font-medium text-sm min-w-[80px]",
                                isSelected
                                    ? "bg-primary/5 border-primary text-primary"
                                    : "bg-background border-border text-foreground hover:border-primary/50 hover:bg-accent"
                            )}
                        >
                            {/* Custom Radio Circle */}
                            <span className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                isSelected
                                    ? "border-primary"
                                    : "border-muted-foreground/30"
                            )}>
                                {isSelected && (
                                    <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                                )}
                            </span>
                            <span>{option.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
