import type { SVGProps } from "react";
import type { ChartType } from "@/lib/market/types";

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ChartTypeIcon({ type, ...props }: IconProps & { type: ChartType }) {
  switch (type) {
    case "bars":
      return (
        <Svg {...props}>
          <path d="M9 6v15M6.5 9H9M9 18h2.5M19 8v14M16.5 12H19M19 19h2.5" />
        </Svg>
      );
    case "hollow":
      return (
        <Svg {...props}>
          <path d="M10 5v4M10 20v3M18 5v4M18 18v5" />
          <rect x="7.5" y="9.5" width="5" height="10" rx=".5" />
          <rect x="15.5" y="9.5" width="5" height="8" rx=".5" fill="currentColor" />
        </Svg>
      );
    case "line":
      return (
        <Svg {...props}>
          <path d="M4 20l6-7 5 4 9-10" strokeLinejoin="round" />
        </Svg>
      );
    case "area":
      return (
        <Svg {...props}>
          <path d="M4 20l6-7 5 4 9-10" strokeLinejoin="round" />
          <path d="M4 20l6-7 5 4 9-10V23H4z" fill="currentColor" fillOpacity=".2" stroke="none" />
        </Svg>
      );
    case "baseline":
      return (
        <Svg {...props}>
          <path d="M3 15h22" strokeDasharray="2 2" />
          <path d="M4 19l5-6 4 3 4-8 4 5 4-2" strokeLinejoin="round" />
        </Svg>
      );
    default:
      return (
        <Svg {...props}>
          <path d="M10 5v4M10 20v3M18 5v4M18 18v5" />
          <rect x="7.5" y="9.5" width="5" height="10" rx=".5" fill="currentColor" />
          <rect x="15.5" y="9.5" width="5" height="8" rx=".5" />
        </Svg>
      );
  }
}

export function IndicatorsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M11.5 7.5c-1.6 0-2.4.9-2.7 2.6L7.6 21c-.3 1.7-1.1 2.5-2.6 2.5" />
      <path d="M6.5 12.5h6" />
      <path d="M15 12l7 9M22 12l-7 9" />
    </Svg>
  );
}

export function CrosshairIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 4v8M14 16v8M4 14h8M16 14h8" />
    </Svg>
  );
}

export function TrendLineIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7.5 20.5l13-13" />
      <circle cx="6" cy="22" r="2" />
      <circle cx="22" cy="6" r="2" />
    </Svg>
  );
}

export function HorizontalLineIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 14h7M18 14h7" />
      <circle cx="14" cy="14" r="2.5" />
    </Svg>
  );
}

export function FibIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h20M4 11h20M4 16h20M4 22h20" />
      <circle cx="8" cy="22" r="2" fill="currentColor" stroke="none" />
      <circle cx="20" cy="6" r="2" fill="currentColor" stroke="none" />
    </Svg>
  );
}
