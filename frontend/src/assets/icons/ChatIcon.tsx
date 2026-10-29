import { ChatBubbleLeftEllipsisIcon } from "@heroicons/react/24/outline";
import React from "react";

type ChatIconprops = React.SVGProps<SVGSVGElement> & {
  className?: string;
  style?: React.CSSProperties;
};

const ChatIcon: React.FC<ChatIconprops> = ({ className, style, ...props }) => (
  <ChatBubbleLeftEllipsisIcon className={className} style={style} {...props} />
);

export default ChatIcon;
