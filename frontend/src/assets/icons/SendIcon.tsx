import React from 'react';

type SendIconProps = React.SVGProps<SVGSVGElement> & {
  fill?: string;
};

const SendIcon: React.FC<SendIconProps> = ({ className, style, fill = 'none', ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 56 56"
    className={className}
    style={style}
    {...props}
  >
    <circle cx="28" cy="28" r="24" fill={fill} />
    <path
      fill="#fff"
      d="M19.607 36.139a1.14 1.14 0 0 1-1.091-.1 1.07 1.07 0 0 1-.516-.961v-5.165l9.182-2.297L18 25.321v-5.165a1.07 1.07 0 0 1 .516-.961 1.14 1.14 0 0 1 1.091-.102l17.676 7.465a1.146 1.146 0 0 1 0 2.124z"
    />
  </svg>
);

export default SendIcon;
