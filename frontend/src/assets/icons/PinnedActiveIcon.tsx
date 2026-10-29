import React from 'react';

type PinnedActiveIconProps = React.SVGProps<SVGSVGElement> & {
  className?: string;
  style?: React.CSSProperties;
};

const PinnedActiveIcon: React.FC<PinnedActiveIconProps> = ({
  className,
  style,
  fill: _fill,
  stroke: _stroke,
  viewBox: _viewBox,
  ...props
}) => {
  const { fill: _styleFill, stroke, ...restStyle } = style ?? {};

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      style={{ ...restStyle, color: restStyle.color || stroke }}
      aria-hidden="true"
      {...props}
    >
      <path
        fill="currentColor"
        d="M16 9.5c0-.28.22-.5.5-.5A3 3 0 0 0 13.5 6h-3A3 3 0 0 0 7.5 9c0 .28.22.5.5.5A2.5 2.5 0 0 1 9.4 11.76v1.62l-2.23 1.13A3 3 0 0 0 5.5 15.24V16a2 2 0 0 0 2 2H11v3.5a.5.5 0 0 0 1 0V18h3.5a2 2 0 0 0 2-2v-.76a3 3 0 0 0-1.67-2.73L13.6 13.38v-1.62A2.5 2.5 0 0 1 16 9.5Z"
      />
    </svg>
  );
};

export default PinnedActiveIcon;
