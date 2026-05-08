import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-12 w-full rounded-2xl border border-ink/10 bg-white px-4 text-sm text-ink shadow-sm outline-none transition placeholder:text-ink/35 focus:border-lagoon focus:ring-2 focus:ring-lagoon/20",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
