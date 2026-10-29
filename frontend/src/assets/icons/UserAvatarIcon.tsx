import React from 'react';

interface UserAvatarIconProps {
  url?: string;
  base64?: string;
  size?: number; 
}

const UserAvatarIcon: React.FC<UserAvatarIconProps> = ({ url, base64, size = 20 }) => {
  if (url) {
    return <img src={url}  width={size} height={size}   className="rounded-full h-[20px]" />;
  }

  if (base64) {
    return <img src={`data:image/png;base64,${base64}`}  width={size} height={size} className="rounded-full " />;
  }

  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.6667 17.5V15.8333C16.6667 14.9493 16.3155 14.1014 15.6904 13.4763C15.0653 12.8512 14.2174 12.5 13.3333 12.5H6.66667C5.78261 12.5 4.93476 12.8512 4.30964 13.4763C3.68452 14.1014 3.33333 14.9493 3.33333 15.8333V17.5M13.3333 5.83333C13.3333 7.67428 11.841 9.16667 10 9.16667C8.15905 9.16667 6.66667 7.67428 6.66667 5.83333C6.66667 3.99238 8.15905 2.5 10 2.5C11.841 2.5 13.3333 3.99238 13.3333 5.83333Z"
        stroke="#667085"
        strokeWidth="1.67"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default UserAvatarIcon;
