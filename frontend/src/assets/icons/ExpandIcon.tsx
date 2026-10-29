import React from "react";

type ExpandIconProps = React.SVGProps<SVGSVGElement> & {
  className?: string;
  style?: React.CSSProperties;
};

const ExpandIcon: React.FC<ExpandIconProps> = ({ className, style, ...props }) => (
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
      <path d="m16.555 6.869 3.6 3.6-3.6 3.6" data-name="Path 1817" />
      <path d="M20.152 10.516H10.011" data-name="Path 1818" />
    </g>
  </svg>
);

export default ExpandIcon;
