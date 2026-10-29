import React from "react";

type AudioStopIconProps = React.SVGProps<SVGSVGElement> & {
  className?: string;
  style?: React.CSSProperties;
};

const AudioStopIcon: React.FC<AudioStopIconProps> = ({ className, style, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 56 56"
    className={className}
    style={style}
    preserveAspectRatio="xMidYMid meet"
    {...props}
  >
    <circle
      cx="28"
      cy="28"
      r="24"
      fill={style?.fill || "#C6A75D"}
      stroke="none"
      shapeRendering="geometricPrecision"
    />
    <rect x="20.5" y="20.5" width="15" height="15" fill="#fff" />
  </svg>
);

export default AudioStopIcon;
