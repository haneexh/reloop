import React, {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
} from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full rounded-[3px] border px-3 py-2 text-xs font-sans text-[#151817] bg-white transition-colors placeholder:text-[#a1aaa4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d57] focus-visible:border-[#2e7d57] disabled:bg-[#f4f5f1] disabled:text-[#a1aaa4] ${
          error ? "border-[#a3512b] focus-visible:ring-[#a3512b]" : "border-[#d8ddd7]"
        } ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`w-full rounded-[3px] border px-3 py-2 text-xs font-sans text-[#151817] bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d57] focus-visible:border-[#2e7d57] disabled:bg-[#f4f5f1] disabled:text-[#a1aaa4] ${
          error ? "border-[#a3512b] focus-visible:ring-[#a3512b]" : "border-[#d8ddd7]"
        } ${className}`}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`w-full rounded-[3px] border px-3 py-2 text-xs font-sans text-[#151817] bg-white transition-colors placeholder:text-[#a1aaa4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d57] focus-visible:border-[#2e7d57] disabled:bg-[#f4f5f1] disabled:text-[#a1aaa4] ${
          error ? "border-[#a3512b] focus-visible:ring-[#a3512b]" : "border-[#d8ddd7]"
        } ${className}`}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export function FormField({
  label,
  required,
  error,
  helperText,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[#151817] flex items-center gap-1">
          <span>{label}</span>
          {required && <span className="text-[#a3512b] text-xs font-bold" title="Required">*</span>}
        </label>
        {helperText && !error && (
          <span className="text-[11px] text-[#6b746e]">{helperText}</span>
        )}
      </div>
      {children}
      {error && <p className="text-[11px] font-medium text-[#a3512b]">{error}</p>}
    </div>
  );
}
