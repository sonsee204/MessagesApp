import React from "react";
import { cn } from "../../lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "raised" | "strong";
}

/**
 * Thành phần Thẻ (Card) phong cách UI/UX Pro Max:
 * 1. Bo góc chuẩn md (24px)
 * 2. Viền 2px #2d3748
 * 3. Đổ bóng khối xúc giác shadow.1 (6px 6px với inner shadow)
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const variantStyles = {
      default: "bg-uupm-surface",
      // Dùng alpha của token thay vì hex pastel cứng: màu tự đổi theo theme và
      // vẫn hoà với nền vì là chính màu accent pha loãng.
      raised: "bg-uupm-accent/10",
      strong: "bg-uupm-accent-soft",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-md border-2 border-uupm-line shadow-uupm-1 text-uupm-ink overflow-hidden transition-[background-color,box-shadow,transform]",
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pb-4 flex flex-col space-y-1.5", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn("text-2xl font-black text-uupm-ink tracking-tight", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm font-semibold text-uupm-ink-muted", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-4 flex items-center justify-between border-t border-uupm-ink-muted/40", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";
