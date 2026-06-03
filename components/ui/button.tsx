import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-cyan-400 to-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25 hover:from-cyan-300 hover:to-cyan-400 hover:shadow-lg hover:shadow-cyan-500/30",
        secondary:
          "bg-slate-800/90 text-slate-100 border border-slate-700/80 shadow-sm hover:bg-slate-700/90 hover:border-slate-600",
        outline:
          "border border-slate-600/80 bg-slate-900/40 hover:bg-slate-800/80 hover:border-slate-500",
        ghost: "hover:bg-slate-800/60 text-slate-300",
        destructive:
          "bg-red-600/90 text-white shadow-md shadow-red-900/30 hover:bg-red-500 border border-red-500/30",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-6",
        icon: "h-9 w-9 rounded-xl",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
