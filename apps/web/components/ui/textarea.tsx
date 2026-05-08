import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-[132px] w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink shadow-sm outline-none transition placeholder:text-ink/35 focus:border-lagoon focus:ring-2 focus:ring-lagoon/20",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
