"use client";

import * as React from "react";
import { cn } from "~/common/utils";

interface SpinnerProps extends React.ComponentPropsWithoutRef<"svg"> {
  size?: number;
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 21, className, ...props }) => {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      stroke="currentColor"
      className={cn("iz-spinner", className)}
      {...props}
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.25" />
      <path
        d="M5.96 10.08L10.08 5.96"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="15"
        strokeDashoffset="15"
      />
      <path
        d="M3.14 3.14L10.08 10.08"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="10"
        strokeDashoffset="30"
      />
      <path
        d="M1.73 4.97L6.91 10.16L10.94 6.24"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="15"
        strokeDashoffset="45"
      />
      <circle
        cx="8"
        cy="8"
        r="7"
        strokeDasharray="45"
        strokeLinecap="round"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeDashoffset="30"
        transform="rotate(180 8 8)"
      />
    </svg>
  );
};
