import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "ios-touch-target relative isolate inline-flex items-center justify-center gap-2 overflow-hidden rounded-full border border-transparent font-medium tracking-normal transition-[color,background-color,border-color,opacity,transform,box-shadow,filter] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.99] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-[0.45]",
  {
    variants: {
      variant: {
        primary: "iz-liquid-primary",
        secondary:
          "border-border/70 bg-surface-2 text-foreground hover:border-border hover:bg-surface-3 active:bg-surface-3",
        outline: "iz-glass iz-liquid-control text-primary",
        ghost:
          "border-transparent text-muted hover:bg-foreground/[0.055] hover:text-foreground active:bg-foreground/[0.075]",
        text: "border-transparent text-primary hover:text-primary/80 active:text-primary/70"
      },
      tone: {
        default: "",
        destructive: ""
      },
      size: {
        xs: "min-h-11 px-3 ios-footnote",
        sm: "min-h-11 px-3.5 ios-subhead",
        md: "min-h-11 px-4 ios-body",
        lg: "min-h-12 px-6 ios-body",
        xl: "min-h-14 px-8 ios-title-3",
        "2xl": "min-h-16 px-10 ios-title-2"
      },
      wide: {
        true: "w-full"
      }
    },
    compoundVariants: [
      {
        tone: "destructive",
        variant: "primary",
        className: "iz-liquid-danger focus-visible:ring-danger/35"
      },
      {
        tone: "destructive",
        variant: "secondary",
        className:
          "border-danger/18 text-danger hover:border-danger/24 hover:bg-danger/10 focus-visible:ring-danger/35"
      },
      {
        tone: "destructive",
        variant: "outline",
        className:
          "border-danger/28 text-danger hover:border-danger/36 hover:bg-danger/10 focus-visible:ring-danger/35"
      },
      {
        tone: "destructive",
        variant: "ghost",
        className: "text-danger hover:bg-danger/10 active:bg-danger/15 focus-visible:ring-danger/35"
      },
      {
        tone: "destructive",
        variant: "text",
        className: "text-danger hover:text-danger/90 focus-visible:ring-danger/35"
      }
    ],
    defaultVariants: {
      variant: "primary",
      tone: "default",
      size: "md",
      wide: false
    }
  }
);
