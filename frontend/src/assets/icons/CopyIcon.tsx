import React from "react";

type CopyIconProps = React.SVGProps<SVGSVGElement> & {
  className?: string;
  style?: React.CSSProperties;
};

const CopyIcon: React.FC<CopyIconProps> = ({ className, style, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 56 56"
    className={className}
    style={style}
    preserveAspectRatio="xMidYMid meet"
    {...props}
  >
    <path
      fill={style?.fill}
      stroke={style?.stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M22.616 14.877V6.959c0-1.081.876-1.957 1.957-1.957h24.469c1.081 0 1.957.876 1.957 1.957v32.21a1.957 1.957 0 0 1-1.957 1.957H33.383"
    />
    <rect
      width="28.384"
      height="36.121"
      x="5"
      y="14.877"
      fill={style?.fill}
      stroke={style?.stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      rx="1"
      ry="1"
    />
  </svg>
);

export default CopyIcon;
