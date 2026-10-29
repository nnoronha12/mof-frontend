import React from "react";

type AiStarsIconProps = React.SVGProps<SVGSVGElement> & {
  fill?: string;
  stroke?: string;
};

const AiStarsIcon: React.FC<AiStarsIconProps> = ({
  className,
  style,
  fill = "none",
  stroke = "currentColor",
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 37.61 39.548"
    className={className}
    style={style}
    preserveAspectRatio="xMidYMid meet"
    {...props}
  >
    <g stroke={stroke} fill={fill} data-name="Group 6148">
      <path
        d="m25.891 0 2.372 7.255a3.14 3.14 0 0 0 2.092 2.092l7.255 2.372-7.255 2.372a3.14 3.14 0 0 0-2.092 2.092l-2.372 7.255-2.372-7.255a3.14 3.14 0 0 0-2.092-2.092l-7.255-2.372 7.255-2.372a3.14 3.14 0 0 0 2.092-2.092Z"
        data-name="Path 3037"
      />
      <path
        d="m9.147 18.447 1.9 5.7a2.33 2.33 0 0 0 1.553 1.549l5.695 1.9-5.695 1.9a2.33 2.33 0 0 0-1.553 1.553l-1.9 5.695-1.9-5.695a2.33 2.33 0 0 0-1.553-1.553l-5.695-1.9 5.695-1.9a2.33 2.33 0 0 0 1.553-1.553Z"
        data-name="Path 3038"
      />
      <path
        d="m28.977 27.595 1.241 3.722a1.53 1.53 0 0 0 1.015 1.015l3.721 1.24-3.721 1.241a1.52 1.52 0 0 0-1.015 1.015l-1.241 3.721-1.241-3.721a1.52 1.52 0 0 0-1.015-1.015L23 33.573l3.721-1.24a1.53 1.53 0 0 0 1.015-1.015Z"
        data-name="Path 3192"
      />
    </g>
  </svg>
);

export default AiStarsIcon;
