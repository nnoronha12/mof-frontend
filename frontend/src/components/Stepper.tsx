import React from "react";
import tinycolor from "tinycolor2";
import { ThemeColors } from "./WeaveAiChat";

type StepStatus = "completed" | "current" | "upcoming";

interface StepperProps {
  steps: string[];
  currentStepIndex: number;
  themeColors: ThemeColors;
}

const StepIndicator: React.FC<{
  status: StepStatus;
  index: number;
  themeColors: ThemeColors;
}> = ({ status, index, themeColors }) => {
  const darkAccentColor = tinycolor(themeColors.accent).darken(13).toString();
  const bgColor =status === "completed" || status === "current"? themeColors.primary : darkAccentColor;
  const borderColor = status === "completed" || status === "current"  ? themeColors.primary: darkAccentColor;
  const textColor = "#fff";
  const fontWeight = status === "upcoming" ? "bold" : "normal";

  return (
    <div
      className="w-5 h-5 flex items-center justify-center rounded-full border-4 text-xs"
      style={{
        backgroundColor: bgColor,
        borderColor: borderColor,
        color: textColor,
        fontWeight: fontWeight,
      }}
    >
      {index + 1}
    </div>
  );
};

const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStepIndex,
  themeColors,
}) => {
  const getStatus = (index: number): StepStatus => {
    if (index < currentStepIndex) return "completed";
    if (index === currentStepIndex) return "current";
    return "upcoming";
  };

  const darkAccentColor = tinycolor(themeColors.accent).darken(13).toString();

  return (
    <div className="flex flex-col space-y-8 pr-6 relative">
      {steps.map((title, index) => {
        const status = getStatus(index);
        const isStepActive = status === "completed" || status === "current";
        const stepTextColor = isStepActive? themeColors.primary : darkAccentColor;
        const isLineActive = status === "completed" || status === "current";
        const lineColor = isLineActive ? themeColors.primary  : darkAccentColor;

        return (
          <div
            key={index}
            className="flex flex-row-reverse items-start space-x-reverse space-x-5"
          >
            <div className="relative flex flex-col items-center">
              <StepIndicator
                status={status}
                index={index}
                themeColors={themeColors}
              />
              {index !== steps.length - 1 && (
                <div
                  className="absolute w-[4px]"
                  style={{
                    top: "1.270rem",
                    height: "2.625rem",
                    backgroundColor: lineColor,
                  }}
                />
              )}
            </div>
            <span
              className="min-w-[120px] text-sm text-right"
              style={{
                color: stepTextColor,
                fontWeight:
                  status === "current" || status === "completed"
                    ? "600"
                    : "400",
              }}
            >
              {title}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default Stepper;
