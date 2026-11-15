import { cva, type VariantProps } from "class-variance-authority"

// The app's button look (webapp/components/ui/button.tsx): a flat key fill, clay for secondary, 8px corners
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent text-sm font-bold whitespace-nowrap transition-all outline-none select-none focus-visible:border-fd-ring focus-visible:ring-[3px] focus-visible:ring-fd-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-key text-key-foreground shadow-key hover:brightness-108 active:shadow-[inset_0_1px_2px_rgb(0_0_0/0.12)]",
        secondary: "border-line bg-clay text-fd-foreground shadow-clay hover:bg-chip active:shadow-[inset_0_1px_2px_rgb(0_0_0/0.12)]",
        ghost: "hover:bg-line-2 hover:text-fd-foreground",
      },
      size: {
        default: "h-9 gap-1.5 px-3",
        sm: "h-8 gap-1 px-3",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export type ButtonProps = VariantProps<typeof buttonVariants>
