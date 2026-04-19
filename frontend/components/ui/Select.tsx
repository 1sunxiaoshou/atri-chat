import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from "../../utils/cn"
import { useLanguage } from '../../contexts/LanguageContext';

export interface SelectOption {
  label: string;
  value: string;
  group?: string;
  icon?: React.ReactNode;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled = false
}) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const resolvedPlaceholder = placeholder ?? t('ui.selectPlaceholder');

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const groupedOptions = options.reduce((acc, option) => {
    const group = option.group || 'Other';
    if (!acc[group]) {acc[group] = [];}
    acc[group].push(option);
    return acc;
  }, {} as Record<string, SelectOption[]>);

  const hasGroups = Object.keys(groupedOptions).length > 1 || (Object.keys(groupedOptions).length === 1 && Object.keys(groupedOptions)[0] !== 'Other');

  return (
    <div className={cn("relative min-w-[140px]", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "ring-1 ring-ring"
        )}
      >
        <span className="truncate">
          {selectedOption ? (
            <span className="flex items-center gap-2">
              {selectedOption.icon}
              {selectedOption.label}
            </span>
          ) : (
            <span className="text-muted-foreground">{resolvedPlaceholder}</span>
          )}
        </span>
        <ChevronDown size={14} className={cn("text-muted-foreground transition-transform opacity-50", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md z-50 custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
          <div className="p-1">
            {hasGroups ? (
              Object.entries(groupedOptions).map(([group, groupOptions]) => (
                <div key={group}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-popover">
                    {group}
                  </div>
                  {groupOptions.map(option => (
                    <OptionItem
                      key={option.value}
                      option={option}
                      isSelected={value === option.value}
                      onClick={() => handleSelect(option.value)}
                    />
                  ))}
                </div>
              ))
            ) : (
              options.map(option => (
                <OptionItem
                  key={option.value}
                  option={option}
                  isSelected={value === option.value}
                  onClick={() => handleSelect(option.value)}
                />
              ))
            )}
            {options.length === 0 && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">{t('ui.noOptions')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const OptionItem: React.FC<{ option: SelectOption; isSelected: boolean; onClick: () => void }> = ({ option, isSelected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      isSelected && "bg-accent text-accent-foreground"
    )}
  >
    <span className="flex items-center gap-2 truncate">
      {option.icon}
      {option.label}
    </span>
    {isSelected && (
      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <Check size={14} />
      </span>
    )}
  </button>
);

export default Select;
