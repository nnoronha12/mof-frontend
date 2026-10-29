import React from "react";

type GoArrowRightIconProps = React.SVGProps<SVGSVGElement> & {
  fill?: string;
  stroke?: string;
};

const GoArrowRightIcon: React.FC<GoArrowRightIconProps> = ({
  className,
  style,
  fill = "currentColor",
  stroke = "none",
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    className={className}
    style={style}
    preserveAspectRatio="xMidYMid meet"
    fill={fill}
    stroke={stroke}
    {...props}
  >
    <path d="M10.5 3.5a.75.75 0 0 0-1.06 1.06L11.44 6.5H2.75a.75.75 0 0 0 0 1.5h8.69l-2 1.94a.75.75 0 1 0 1.06 1.06l3.25-3.25a.75.75 0 0 0 0-1.06l-3.25-3.25Z" />
  </svg>
);

export default GoArrowRightIcon;
