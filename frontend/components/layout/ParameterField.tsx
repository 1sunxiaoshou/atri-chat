import React from 'react';
import { ParameterSchema } from '../../types';
import { RadioGroup } from '../ui';

interface ParameterFieldProps {
    name: string;
    schema: ParameterSchema;
    value: any;
    onChange: (name: string, value: any) => void;
}

const ParameterField: React.FC<ParameterFieldProps> = ({
    name,
    schema,
    value,
    onChange
}) => {
    const renderField = () => {
        switch (schema.type) {
            case 'slider': {
                const isAuto = value === undefined || value === null;
                const displayValue = isAuto ? schema.default : value;
                const initialSliderValue = isAuto ? (schema.max ?? 128000) : displayValue;

                return (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-foreground">
                                {schema.label}
                            </label>
                            <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">
                                {isAuto && (displayValue === undefined || displayValue === null)
                                    ? 'auto'
                                    : displayValue?.toFixed(schema.step && schema.step < 1 ? 1 : 0)}
                            </span>
                        </div>

                        <input
                            type="range"
                            min={schema.min ?? 0}
                            max={schema.max ?? 1}
                            step={schema.step ?? 0.1}
                            value={initialSliderValue ?? 0}
                            onChange={(e) => onChange(name, parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary hover:accent-primary/80 transition-all"
                        />
                    </div>
                );
            }

            case 'number':
                return (
                    <div className="space-y-2">
                        <label className="text-sm text-foreground">
                            {schema.label}
                        </label>
                        <input
                            type="number"
                            min={schema.min}
                            max={schema.max}
                            step={schema.step ?? 1}
                            value={value ?? schema.default ?? ''}
                            onChange={(e) => onChange(name, e.target.value ? parseInt(e.target.value) : undefined)}
                            className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all"
                            placeholder={schema.label}
                        />
                    </div>
                );

            case 'boolean':
                return (
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50 hover:border-primary/30 transition-all">
                        <label className="text-sm text-foreground">
                            {schema.label}
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={value ?? schema.default ?? false}
                                onChange={(e) => onChange(name, e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-muted border border-border rounded-full peer peer-checked:bg-primary peer-checked:border-primary transition-all duration-300 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full after:shadow-sm"></div>
                        </label>
                    </div>
                );

            case 'segmented':
                return (
                    <RadioGroup
                        label={schema.label}
                        value={value ?? schema.default ?? schema.options?.[0]?.value ?? ''}
                        onChange={(val) => onChange(name, val)}
                        options={schema.options?.map(opt => ({
                            label: opt.label,
                            value: String(opt.value)
                        })) ?? []}
                        variant="segmented"
                    />
                );

            case 'select':
                return (
                    <div className="space-y-2">
                        <label className="text-sm text-foreground">
                            {schema.label}
                        </label>
                        <select
                            value={value ?? schema.default ?? ''}
                            onChange={(e) => onChange(name, e.target.value)}
                            className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all"
                        >
                            {schema.options?.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                );

            case 'text':
                return (
                    <div className="space-y-2">
                        <label className="text-sm text-foreground">
                            {schema.label}
                        </label>
                        <input
                            type="text"
                            value={value ?? schema.default ?? ''}
                            onChange={(e) => onChange(name, e.target.value)}
                            className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all"
                            placeholder={schema.label}
                        />
                    </div>
                );

            default:
                return null;
        }
    };

    return <div>{renderField()}</div>;
};

export default ParameterField;
