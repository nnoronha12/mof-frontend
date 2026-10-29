import type { ChatAction } from '../../services/chatEnvelope';
import React, { useLayoutEffect, useRef, useState, useEffect, useMemo } from "react";
import * as am5 from "@amcharts/amcharts5";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { BrickWall, ChartArea, ChartBar, ChartCandlestick, ChartColumn, ChartColumnStacked, ChartLine, ChartScatter, Dice5, Donut, Funnel, Globe2, TrendingDown } from "lucide-react";
import {
  AreaChart,
  BarChart,
  CandlestickChart,
  ChordChart,
  ColumnChart,
  FunnelChart,
  GeoChart,
  LineChart,
  PieChart,
  SankeyChart,
  ScatterChart,
  StackedColumnChart,
  TreemapChart,
} from "./ChartTypes";
import { ThemeColors } from "../WeaveAiChat";
import { twMerge } from "tailwind-merge";
import {
  ChartPieIcon,
  ChevronDownIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { getChartHeading } from "./chartModel";




export const DEFAULT_CHART_TYPE = 13;
export const CHART_TYPE_MENU_ORDER = [13, 12, 1];

const ALLOWED_CHART_TYPES = new Set(CHART_TYPE_MENU_ORDER);

/**
 * Use the chart type the backend sent (line=1, bar=12, column=13).
 * Column is only the fallback when the type is missing or unsupported.
 */
export const resolveInitialChartType = (type?: unknown) => {
  const chartType = Number(type);
  if (ALLOWED_CHART_TYPES.has(chartType)) return chartType;
  return DEFAULT_CHART_TYPE;
};

export interface ChartState {
  chartDisplay: boolean;
  chartType: number;
  chartData: any;
  altType: number[];
  messageID: number;
}
interface ChartType {
  id: string;
  chartId: number;
  name: string;
  description: string;
  icon: any;
}
let chartTypes : ChartType[] = [
  {
    id: "column",
    chartId: 13,
    name: "Column Chart",
    description: "Compare values across categories",
    icon: ChartColumn,
  },
  {
    id: "pie",
    chartId: 2,
    name: "Pie Chart",
    description: "Show parts of a whole",
    icon: ChartPieIcon,
  },
  {
    id: "donut",
    chartId: 3,
    name: "Donut Chart",
    description: "Show parts of a whole (donut style)",
    icon: Donut,
  },
  {
    id: "treemap",
    chartId: 4,
    name: "Treemap",
    description: "Visualize hierarchical data",
    icon: BrickWall,
  },
  {
    id: "stackedColumn",
    chartId: 5,
    name: "Stacked Column",
    description: "Compare parts of a whole across categories",
    icon: ChartColumnStacked,
  },
  {
    id: "sankey",
    chartId: 6,
    name: "Sankey Diagram",
    description: "Show flow between stages or nodes",
    icon: TrendingDown,
  },
  {
    id: "funnel",
    chartId: 7,
    name: "Funnel Chart",
    description: "Show progressive reduction",
    icon: Funnel,
  },
  {
    id: "candlestick",
    chartId: 8,
    name: "Candlestick Chart",
    description: "Show stock price movements",
    icon: ChartCandlestick,
  },
  {
    id: "scatter",
    chartId: 9,
    name: "Scatter Plot",
    description: "Visualize correlations between variables",
    icon: ChartScatter,
  },
  {
    id: "geo",
    chartId: 10,
    name: "Geo Chart",
    description: "Map data to geographic regions",
    icon: Globe2,
  },
  {
    id: "chord",
    chartId: 11,
    name: "Chord Diagram",
    description: "Show relationships between groups",
    icon: Dice5,
  },
  {
    id: "bar",
    chartId: 12,
    name: "Bar Chart",
    description: "Compare values across categories",
    icon: ChartBar,
  },
  {
    id: "line",
    chartId: 1,
    name: "Line Chart",
    description: "Show trends over time",
    icon: ChartLine,
  },
  {
    id: "area",
    chartId: 14,
    name: "Area Chart",
    description: "Show trends over time",
    icon: ChartArea,
  },
];

export const useAmChart = (
  renderer: (root: am5.Root, container: am5.Container) => void,
  deps: any[]
) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const amRootRef = useRef<any>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    // Charts must stay LTR even when the chat UI is Arabic, otherwise
    // axis titles and in-bar values flip and get clipped.
    ref.current.setAttribute("dir", "ltr");
    ref.current.style.direction = "ltr";
    if (amRootRef.current) {
      amRootRef.current.dispose();
      amRootRef.current = null;
    }
    const root = am5.Root.new(ref.current);
    amRootRef.current = root;
    root.setThemes([am5themes_Animated.new(root)]);
    renderer(root, root.container);
    root._logo?.dispose();

    return () => {
      if (amRootRef.current) amRootRef.current.dispose();
      amRootRef.current = null;
    };
  }, deps);

  return ref;
};

export const parseDate = (d: string | number | Date) => {
  if (d instanceof Date) return d;
  if (typeof d === "number") return new Date(d);
  return new Date(d);
};

export const RenderChart = ({
  setChartState,
  chartState,
  actions,
  themeColors,
  isFullScreen,
  onclose,
}: {
  setChartState: React.Dispatch<React.SetStateAction<ChartState>>;
  chartState: ChartState;
  actions?: ChatAction[];
  themeColors: ThemeColors;
  isFullScreen?: boolean;
  onclose?: () => void;
}) => {
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState("column");

  const filteredChartTypes = useMemo(() => {
    const allowed = chartTypes.filter((chartType) =>
      actions?.some(action => action.action === 'chart.setType' && Number(action.payload?.chartType) === chartType.chartId)
    );
    return [...allowed].sort((a, b) => {
      const aIndex = CHART_TYPE_MENU_ORDER.indexOf(a.chartId);
      const bIndex = CHART_TYPE_MENU_ORDER.indexOf(b.chartId);
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    });
  }, [actions]);

  useEffect(() => {
    const matched = chartTypes.find(
      (type) => type.chartId === chartState.chartType
    );
    setSelectedChartType(matched?.id || "column");
  }, [chartState.chartType]);



  const handleChartTypeSelection = (type: any) => {
    if (!type) return;
    setChartState((prev) => ({
      ...prev,
      chartType: type.chartId,
    }));
    setSelectedChartType(type.id);
    setShowTypeSelector(false);
  };

  const selectedType = filteredChartTypes.find(
    (type) => type.id === selectedChartType
  );
  
  const SelectedIcon = selectedType?.icon;
  const heading = getChartHeading(chartState.chartData);

  const containerClasses = isFullScreen
    ? "w-full h-full max-h-screen flex flex-col overflow-visible bg-gradient-to-br from-[#FAF8F3] via-white to-[#FFF9E8] rounded-xl border border-[rgba(198,167,93,0.28)] shadow-sm"
    : "w-[70vw] md:w-[35rem] overflow-visible bg-gradient-to-br from-[#FAF8F3] via-white to-[#FFF9E8] rounded-xl border border-[rgba(198,167,93,0.28)] shadow-sm mt-2";

  const chartContainerClasses = isFullScreen
    ? "flex-1 w-full min-h-0 overflow-x-auto overflow-y-auto"
    : "w-full h-[40vh] min-h-[20rem] md:h-[40vh] lg:h-[48vh] px-2 pb-2";

  return (
    <div
      dir="ltr"
      className={containerClasses+" relative"}
      style={showTypeSelector ? { zIndex: 30 } : undefined}
    >
      {isFullScreen && (
        <button onClick={onclose} className="block sm:hidden absolute left-0 top-0 p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <XMarkIcon className="w-5 h-5 text-gray-500" />
        </button>
      )}
      <div className={twMerge("flex items-center justify-between m-2 sm:m-3 flex-shrink-0", isFullScreen && "ml-[2rem] sm:ml-3")}>
        <div className="text-center flex-1">
          <div dir="auto" className="text-base sm:text-lg font-semibold text-gray-800 mb-0.5 sm:mb-1">
            {heading.title}
          </div>
          {heading.subtitle && (
            <p dir="auto" className="text-xs sm:text-sm text-gray-500">
              {heading.subtitle}
            </p>
          )}
          <div
            className="w-16 h-0.5 mx-auto mt-1 sm:mt-2"
            style={{
              backgroundImage: `linear-gradient(to right, ${themeColors.primary}, ${themeColors.secondary})`,
            }}
          ></div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {filteredChartTypes.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowTypeSelector(!showTypeSelector)}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm"
              >
                {SelectedIcon && (
                  <SelectedIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
                <span className="max-w-[80px] sm:max-w-none truncate sm:truncate-none">
                  {selectedType?.name}
                </span>
                <ChevronDownIcon
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 sm:ml-2 transition-transform duration-300 ${
                    showTypeSelector ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showTypeSelector && (
                <div
                  dir="ltr"
                  className="absolute end-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-64 max-h-72 overflow-y-auto"
                >
                  {filteredChartTypes.map((type) => {
                    const Icon = type.icon;
                    const isSelected = selectedChartType === type.id;
                    return (
                      <button
                        key={type.id}
                        onClick={() => handleChartTypeSelection(type)}
                        className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left ${
                          isSelected ? "bg-[rgba(198,167,93,0.10)] border-r-2" : ""
                        }`}
                        style={isSelected ? { borderRightColor: themeColors.primary } : undefined}
                      >
                        {Icon && (
                          <Icon
                            className="w-5 h-5 mt-0.5"
                            style={{
                              color: isSelected
                                ? themeColors.primary
                                : undefined,
                            }}
                          />
                        )}
                        <div>
                          <div
                            className="font-medium"
                            style={{
                              color: isSelected
                                ? themeColors.primary
                                : undefined,
                            }}
                          >
                            {actions?.find(action => action.action === 'chart.setType' && Number(action.payload?.chartType) === type.chartId)?.label}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {type.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className={chartContainerClasses}>
        <div className="h-full w-full">
          <ChartRenderer
            chartType={chartState.chartType}
            chartData={chartState.chartData}
            themeColors={themeColors}
          />
        </div>
      </div>
    </div>
  );
};

export const ChartRenderer = ({
  chartType,
  chartData,
  themeColors,
}: {
  chartType: number;
  chartData: any[];
  themeColors: ThemeColors;
}) => {
  // Column is the fallback for missing or unsupported chart types.
  switch (Number(chartType) || 13) {
    case 1:
      return <LineChart data={chartData} themeColors={themeColors} />;
    case 2:
      return <PieChart chartData={chartData} themeColors={themeColors} />;
    case 3:
      return (
        <PieChart chartData={chartData}  donut={true} themeColors={themeColors} />
      );
    case 4:
      return <TreemapChart chartData={chartData} />;
    case 5:
      return <StackedColumnChart chartData={chartData} />;
    case 6:
      return <SankeyChart data={chartData} />;
    case 7:
      return <FunnelChart chartData={chartData} />;
    case 8:
      return <CandlestickChart data={chartData} />;
    case 9:
      return <ScatterChart data={chartData} />;
    case 10:
      return <GeoChart data={chartData} />;
    case 11:
      return <ChordChart data={chartData} />;
    case 12:
      return <BarChart chartData={chartData} themeColors={themeColors} />;
    case 13:
      return <ColumnChart chartData={chartData} themeColors={themeColors} />;
    case 14:
      return <AreaChart chartData={chartData} themeColors={themeColors} />;
    default:
      return <ColumnChart chartData={chartData} themeColors={themeColors} />;
  }
};
