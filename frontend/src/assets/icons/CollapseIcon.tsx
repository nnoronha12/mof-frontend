import React from "react";

type CollapseIconProps = React.SVGProps<SVGSVGElement> & {
  className?: string;
  style?: React.CSSProperties;
};

const CollapseIcon: React.FC<CollapseIconProps> = ({ className, style, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 25.5 21.5"
    className={className}
    style={style}
    preserveAspectRatio="xMidYMid meet"
    {...props}
  >
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
      <path d="M.75.75h24v20h-24z" data-name="Rectangle 1149" />
      <path d="M7.065 1.257V20.08" data-name="Path 1816" />
      <path d="m13.613 14.072-3.6-3.6 3.6-3.6" data-name="Path 1817" />
      <path d="M10.015 10.426h10.141" data-name="Path 1818" />
    </g>
  </svg>
);

export default CollapseIcon;
