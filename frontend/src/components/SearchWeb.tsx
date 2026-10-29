import React from "react";
import { GlobeAltIcon, XMarkIcon } from "@heroicons/react/24/outline";

type ThemeColors = {
  primary: string;
  accent: string;
};

type SearchWebProps = {
  onClick: () => void;
  label?: string;
  themeColors: ThemeColors;
};

const SearchWeb: React.FC<SearchWebProps> = ({
  onClick,
  label = "Search",
  themeColors,
}) => {
  return (
    <div
      className="relative flex items-center gap-1 p-2 cursor-pointer group rounded-[1.2rem]"
      style={{ backgroundColor: themeColors.accent }}
      onClick={onClick}
    >
      <div className="relative h-5 w-5 flex items-center justify-center">
        <GlobeAltIcon
          className="absolute inset-0 h-5 w-5 transition-opacity duration-100 opacity-100 group-hover:opacity-0"
          stroke={themeColors.primary}
        />
        <XMarkIcon
          className="absolute inset-0 h-5 w-5 transition-opacity duration-100 opacity-0 group-hover:opacity-100"
          stroke={themeColors.primary}
        />
      </div>
      <span
        className="text-sm transition-colors duration-200 pe-1"
        style={{ color: themeColors.primary }}
      >
        {label}
      </span>
    </div>
  );
};

export default SearchWeb;
