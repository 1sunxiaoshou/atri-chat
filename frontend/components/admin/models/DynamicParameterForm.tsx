import { ParameterSchema } from '../../../types';
import { Input, Select } from '../../ui';
import { cn } from '../../../utils/cn';

interface DynamicParameterFormProps {
  schema: Record<string, ParameterSchema>;
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  title?: string;
}

export const DynamicParameterForm: React.FC<DynamicParameterFormProps> = ({
  schema,
  values,
  onChange,
  title
}) => {
  if (Object.keys(schema).length === 0) {return null;}

  const renderField = (key: string, field: ParameterSchema) => {
    const value = values[key] ?? field.default;

    switch (field.type) {
      case 'slider':
      case 'number':
        return (
          <div key={key} className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">{field.label}</label>
              <span className="text-xs text-muted-foreground">{value}</span>
            </div>
            <input
              type="range"
              min={field.min}
              max={field.max}
              step={field.step}
              value={value}
              onChange={(e) => onChange(key, parseFloat(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
        );

      case 'boolean':
        return (
          <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">{field.label}</label>
              {field.description && (
                <p className="text-xs text-muted-foreground">{field.description}</p>
              )}
            </div>
            <button
              onClick={() => onChange(key, !value)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                value ? "bg-primary" : "bg-muted-foreground/30"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  value ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
        );

      case 'select':
      case 'segmented':
        return (
          <div key={key} className="space-y-1.5">
            <label className="text-sm font-medium">{field.label}</label>
            <Select
              value={String(value)}
              onChange={(val) => {
                // 如果原始选项中有数字，则转换回数字
                const option = field.options?.find(o => String(o.value) === val);
                onChange(key, option ? option.value : val);
              }}
              options={(field.options || []).map(opt => ({ 
                ...opt, 
                value: String(opt.value) 
              }))}
            />
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
        );

      case 'text':
        return (
          <Input
            key={key}
            label={field.label}
            value={value || ''}
            onChange={(e) => onChange(key, e.target.value)}
            placeholder={field.description}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {title && (
        <h4 className="text-sm font-semibold text-foreground border-b border-border pb-2">
          {title}
        </h4>
      )}
      <div className="grid grid-cols-1 gap-4">
        {Object.entries(schema)
          .sort(([, a], [, b]) => (a.order || 99) - (b.order || 99))
          .map(([key, field]) => renderField(key, field))}
      </div>
    </div>
  );
};
