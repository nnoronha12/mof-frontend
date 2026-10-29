import React, { useEffect } from "react";
import { parseDate, useAmChart } from "./Amchart";
import * as am5xy from "@amcharts/amcharts5/xy";
import * as am5percent from "@amcharts/amcharts5/percent";
import * as am5hierarchy from "@amcharts/amcharts5/hierarchy";
import * as am5map from "@amcharts/amcharts5/map";
import * as am5 from "@amcharts/amcharts5";
import * as am5flow from "@amcharts/amcharts5/flow";
import { ThemeColors } from "../WeaveAiChat";
import { motion } from "framer-motion";
import { prepareCartesianChart, toFiniteNumber } from "./chartModel";
import { CartesianKind, renderCartesianChart } from "./cartesianChart";

// Utility function to format large numbers with K, M, B notation
const formatDataLabel = (value: number): string => {
  if (value === null || value === undefined || isNaN(value))
    return String(value);

  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absValue >= 1e9) {
    // Billions
    return (
      sign +
      (absValue / 1e9).toFixed(absValue >= 10e9 ? 1 : 2).replace(/\.?0+$/, "") +
      "B"
    );
  } else if (absValue >= 1e6) {
    // Millions
    return (
      sign +
      (absValue / 1e6).toFixed(absValue >= 10e6 ? 1 : 2).replace(/\.?0+$/, "") +
      "M"
    );
  } else if (absValue >= 1e3) {
    // Thousands
    return (
      sign +
      (absValue / 1e3).toFixed(absValue >= 10e3 ? 0 : 1).replace(/\.?0+$/, "") +
      "k"
    );
  } else {
    // Less than 1000 - show as is
    return sign + absValue.toString();
  }
};

const CartesianChart = ({
  chartData,
  kind,
}: {
  chartData: any;
  kind: CartesianKind;
}) => {
  const ref = useAmChart(
    (root) => {
      const model = prepareCartesianChart(chartData);
      if (!model) {
        console.error("Chart has no plottable data:", chartData);
        return;
      }
      renderCartesianChart(root, model, kind);
    },
    [JSON.stringify(chartData), kind]
  );

  return (
    <motion.div
      ref={ref}
      className="w-full h-full"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{ overflow: "visible", direction: "ltr" }}
    />
  );
};

/** Theme colours are accepted for API compatibility; series use the fixed chart palette. */
type CartesianProps = { chartData?: any; data?: any; themeColors?: unknown };

export const LineChart = ({ data, chartData }: CartesianProps) => (
  <CartesianChart chartData={chartData ?? data} kind="line" />
);

export const BarChart = ({ chartData }: CartesianProps) => (
  <CartesianChart chartData={chartData} kind="bar" />
);

export const ColumnChart = ({ chartData }: CartesianProps) => (
  <CartesianChart chartData={chartData} kind="column" />
);


export const PieChart = ({
  chartData,
  themeColors,
  donut = false,
}: {
  chartData: any;
  themeColors: ThemeColors;
  donut?: boolean;
}) => {
  const ref = useAmChart(
    (root, container) => {
      const { data, xField, yField, series } = chartData;
      const chart = container.children.push(
        am5percent.PieChart.new(root, {
          layout: root.verticalLayout,
          innerRadius: donut ? am5.percent(50) : 0,
        })
      );
      const pieSeries = chart.series.push(
        am5percent.PieSeries.new(root, {
          valueField: yField,
          categoryField: xField,
          tooltip: am5.Tooltip.new(root, {
            labelText: "{category} : {value.formatNumber('#,###.#a')}",
          }),
        })
      );

      pieSeries.labels.template.adapters.add("text", function (text, target) {
        const row = target.dataItem?.dataContext as Record<string, unknown> | undefined;
        const value = toFiniteNumber(row?.[yField]);
        const category = row?.[xField];
        if (value !== undefined && category !== undefined) {
          return `${category} : ${formatDataLabel(value)}`;
        }
        return text;
      });
      // Set data
      if (Array.isArray(data)) {
        pieSeries.data.setAll(data);
      }

      chart.appear(1000, 100);
    },
    [JSON.stringify(chartData), donut]
  );
  return <div ref={ref} className="w-full h-full" />;
};

export const AreaChart = ({
  chartData,
  themeColors,
}: {
  chartData: any;
  themeColors: ThemeColors;
}) => {
  const ref = useAmChart(
    (root, container) => {
      const { data, xField, yField, series } = chartData;

      const chart = container.children.push(
        am5xy.XYChart.new(root, {
          panX: true,
          panY: true,
          wheelX: "panX",
          wheelY: "zoomX",
        })
      );

      const xAxisRenderer = am5xy.AxisRendererX.new(root, {
        minGridDistance: 20,
      });

      xAxisRenderer.labels.template.setAll({
        centerY: am5.p50,
        centerX: am5.p100,
        paddingRight: -20,
        oversizedBehavior: "wrap",
        fontSize: 12,
        paddingTop: 10,
      });
      // X Axis → Category (months)
      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: xField,
          renderer: xAxisRenderer,
        })
      );

      const yAxisRenderer = am5xy.AxisRendererY.new(root, {});

      yAxisRenderer.labels.template.setAll({
        fontSize: 12,
        paddingRight: 10,
      });

      // Y Axis → Values
      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: yAxisRenderer,
          numberFormat: "#,###.#a",
        })
      );

      // Series
      series.forEach((s: any) => {
        const areaSeries = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: s.name,
            xAxis,
            yAxis,
            valueYField: s.valueYField,
            categoryXField: s.categoryXField,
            fill: am5.color(themeColors.primary),
            stroke: am5.color(themeColors.primary),
            tooltip: am5.Tooltip.new(root, {
              labelText: "{categoryX}: {valueY.formatNumber('#,###.#a')}",
            }),
          })
        );
        // Add "area fill" below line
        areaSeries.fills.template.setAll({
          fill: am5.color(themeColors.primary),
          fillOpacity: 0.3,
          visible: true,
        });

        areaSeries.strokes.template.setAll({
          strokeWidth: 2,
        });

        areaSeries.bullets.push(function () {
          const bulletLabel = am5.Label.new(root, {
            centerY: am5.p100,
            centerX: am5.p50,
            dy: -5,
            fontSize: 12,
            fontWeight: "bold",
          });

          bulletLabel.adapters.add("text", function (text, target) {
            const dataItem =
              target.dataItem as am5.DataItem<am5xy.IXYSeriesDataItem>;
            if (dataItem) {
              const value = dataItem.get("valueY");
              if (value !== undefined && value !== null) {
                return formatDataLabel(value);
              }
            }
            return "";
          });

          return am5.Bullet.new(root, {
            locationY: 1,
            sprite: bulletLabel,
          });
        });
        areaSeries.data.setAll(data);
      });

      // Bind x-axis categories
      xAxis.data.setAll(data);

      chart.appear(1000, 100);
    },
    [JSON.stringify(chartData)]
  );
  return <div ref={ref} className="w-full h-full" />;
};

export const TreemapChart = ({ chartData }: { chartData: any }) => {
  const ref = useAmChart(
    (root, container) => {
      const { data, xField, yField, series } = chartData;
      const chart = container.children.push(
        am5hierarchy.Treemap.new(root, {
          singleBranchOnly: false,
          downDepth: 1,
          upDepth: -1,
          initialDepth: 2,
          valueField: yField,
          categoryField: xField,
          childDataField: "children",
        })
      );

      chart.rectangles.template.setAll({
        strokeWidth: 2,
      });

      chart.data.setAll([{ name: "Root", children: data }]);
      chart.set("selectedDataItem", chart.dataItems[0]);
      chart.appear(1000, 100);
    },
    [JSON.stringify(chartData)]
  );
  return <div ref={ref} className="w-full h-full" />;
};

export const StackedColumnChart = ({ chartData }: { chartData: any }) => {
  const ref = useAmChart(
    (root, container) => {
      const { data, xField } = chartData;
      if (!data || !xField) {
        console.error("Invalid chartData", chartData);
        return;
      }
      const chart = container.children.push(am5xy.XYChart.new(root, {}));
      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: xField,
          renderer: am5xy.AxisRendererX.new(root, {}),
        })
      );
      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: am5xy.AxisRendererY.new(root, {}),
        })
      );
      const fields = Object.keys(data[0] || {}).filter((f) => f !== xField);
      fields.forEach((f) => {
        const series = chart.series.push(
          am5xy.ColumnSeries.new(root, {
            xAxis,
            yAxis,
            valueYField: f,
            categoryXField: xField,
            stacked: true,
          })
        );
        series.data.setAll(data);
      });
      xAxis.data.setAll(data);
    },
    [JSON.stringify(chartData)]
  );
  return <div ref={ref} />;
};

export const SankeyChart = ({ data }: { data: any[] }) => {
  const ref = useAmChart(
    (root, container) => {
      const sankey = container.children.push(am5flow.Sankey.new(root, {}));
      sankey.links.setAll(data);
    },
    [JSON.stringify(data)]
  );
  return <div ref={ref} className="w-full h-full" />;
};

export const FunnelChart = ({ chartData }: { chartData: any }) => {
  const ref = useAmChart(
    (root, container) => {
      const { data, xField, yField } = chartData;
      if (!data || !xField || !yField) {
        console.error("Invalid chartData", chartData);
        return;
      }
      const chart = container.children.push(am5xy.XYChart.new(root, {}));
      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: xField,
          renderer: am5xy.AxisRendererX.new(root, {}),
        })
      );
      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: am5xy.AxisRendererY.new(root, {}),
        })
      );
      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          valueYField: yField,
          categoryXField: xField,
          xAxis,
          yAxis,
        })
      );
      series.data.setAll(data);
      xAxis.data.setAll(data);
    },
    [JSON.stringify(chartData)]
  );
  return <div ref={ref} className="w-full h-full" />;
};

export const CandlestickChart = ({ data }: { data: any[] }) => {
  const ref = useAmChart(
    (root, container) => {
      const chart = container.children.push(am5xy.XYChart.new(root, {}));
      const xAxis = chart.xAxes.push(
        am5xy.DateAxis.new(root, {
          baseInterval: { timeUnit: "day", count: 1 },
          renderer: am5xy.AxisRendererX.new(root, {}),
        })
      );
      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: am5xy.AxisRendererY.new(root, {}),
        })
      );
      const series = chart.series.push(
        am5xy.CandlestickSeries.new(root, {
          xAxis,
          yAxis,
          valueYField: "close",
          openValueYField: "open",
          lowValueYField: "low",
          highValueYField: "high",
          valueXField: "date",
        })
      );
      series.data.setAll(data.map((d) => ({ ...d, date: parseDate(d.date) })));
    },
    [JSON.stringify(data)]
  );
  return <div ref={ref} className="w-full h-full" />;
};

export const ScatterChart = ({ data }: { data: any[] }) => {
  const ref = useAmChart(
    (root, container) => {
      const chart = container.children.push(am5xy.XYChart.new(root, {}));
      const xAxis = chart.xAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: am5xy.AxisRendererX.new(root, {}),
        })
      );
      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: am5xy.AxisRendererY.new(root, {}),
        })
      );
      const scatter = chart.series.push(
        am5xy.LineSeries.new(root, {
          xAxis,
          yAxis,
          valueXField: "x",
          valueYField: "y",
        })
      );
      scatter.strokes.template.setAll({ visible: false });
      scatter.bullets.push(() =>
        am5.Bullet.new(root, { sprite: am5.Circle.new(root, { radius: 5 }) })
      );
      scatter.data.setAll(data);
    },
    [JSON.stringify(data)]
  );
  return <div ref={ref} className="w-full h-full" />;
};

export const GeoChart = ({ data }: { data: any[] }) => {
  const ref = useAmChart(
    (root, container) => {
      const chart = container.children.push(
        am5map.MapChart.new(root, { projection: am5map.geoMercator() })
      );
      const pointSeries = am5map.MapPointSeries.new(root, {});
      chart.series.push(pointSeries);
      pointSeries.data.setAll(
        data.map((f: any) => ({
          latitude: f.geometry.coordinates[1],
          longitude: f.geometry.coordinates[0],
          name: f.properties?.name,
          value: f.properties?.value,
        }))
      );
    },
    [JSON.stringify(data)]
  );
  return <div ref={ref} className="w-full h-full" />;
};

export const ChordChart = ({ data }: { data: any[] }) => {
  const ref = useAmChart(
    (root, container) => {
      const sankey = container.children.push(am5flow.Sankey.new(root, {}));
      sankey.links.setAll(data);
    },
    [JSON.stringify(data)]
  );
  return <div ref={ref} className="w-full h-full" />;
};
