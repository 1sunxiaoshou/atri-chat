import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  placeholder = 'Select...',
  className,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Group options
  const groupedOptions = options.reduce((acc, option) => {
    const group = option.group || 'Other';
    if (!acc[group]) {acc[group] = [];}
    acc[group].push(option);
    return acc;
  }, {} as Record<string, SelectOption[]>);

  const hasGroups = Object.keys(groupedOptions).length > 1 || (Object.keys(groupedOptions).length === 1 && Object.keys(groupedOptions)[0] !== 'Other');

  return (
    <div className={twMerge("relative min-w-[140px]", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border",
          "bg-white dark:bg-gray-800",
          "border-gray-200 dark:border-gray-700",
          "text-gray-700 dark:text-gray-200",
          "hover:border-blue-400 dark:hover:border-blue-500",
          "focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50",
          disabled && "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900"
        )}
      >
        <span className="truncate">
          {selectedOption ? (
            <span className="flex items-center gap-2">
              {selectedOption.icon}
              {selectedOption.label}
            </span>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={14} className={clsx("text-gray-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl z-50 custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
          {hasGroups ? (
            Object.entries(groupedOptions).map(([group, groupOptions]) => (
              <div key={group}>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/50 dark:bg-gray-900/50 sticky top-0 backdrop-blur-sm">
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
            <div className="px-3 py-4 text-center text-sm text-gray-400">No options</div>
          )}
        </div>
      )}
    </div>
  );
};

const OptionItem: React.FC<{ option: SelectOption; isSelected: boolean; onClick: () => void }> = ({ option, isSelected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={clsx(
      "w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors",
      isSelected 
        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" 
        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
    )}
  >
    <span className="flex items-center gap-2 truncate">
      {option.icon}
      {option.label}
    </span>
    {isSelected && <Check size={14} />}
  </button>
);

export default Select;
