import React from "react";

type MenuIconProps = React.SVGProps<SVGSVGElement> & {
  className?: string;
  style?: React.CSSProperties;
};

const LineMenuIcon: React.FC<MenuIconProps> = ({ className, style, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={style?.strokeWidth || 1.5}
    stroke={style?.stroke || "currentColor"}
    className={className}
    style={style}
    {...props}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />

    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h10" />

    <path strokeLinecap="round" strokeLinejoin="round" d="M3 20h14" />
  </svg>
);

export default LineMenuIcon;
