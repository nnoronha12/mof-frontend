import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import {
  CATEGORY_KEY,
  CATEGORY_LABEL_KEY,
  PreparedChart,
  PreparedSeries,
  formatCompactNumber,
  hasArabicText,
  withUnit,
} from "./chartModel";

export type CartesianKind = "column" | "bar" | "line";

const TEXT_PRIMARY = am5.color(0x1f2937);
const TEXT_SECONDARY = am5.color(0x4b5563);
const TEXT_MUTED = am5.color(0x6b7280);
const GRID = am5.color(0xe5e7eb);
const SURFACE = am5.color(0xffffff);

/** Most value labels drawn at once before the chart relies on tooltips only. */
const MAX_LABELLED_MARKS = 24;
/** Rough width of one value-label character at 10.5px. */
const LABEL_CHAR_WIDTH = 6.2;

/** Row key holding the category label ready for display. */
const DISPLAY_LABEL_KEY = "__display";

/**
 * Wrap Arabic text in a right-to-left isolate. amCharts' own `direction: "rtl"`
 * measures text left-to-right but draws it from the right, which pushes
 * labels outside the chart; the isolate keeps amCharts' layout and lets the
 * browser order mixed Arabic/number text correctly.
 */
const isolate = (text: string) => (hasArabicText(text) ? `\u2067${text}\u2069` : text);

/** Escape amCharts text formatting characters in data-driven text. */
const escapeText = (text: string) => text.replace(/\[/g, "[[").replace(/\{/g, "{{");

const displayText = (text: string) => isolate(escapeText(text));

const addAxisTitle = (
  root: am5.Root,
  axis: am5xy.Axis<am5xy.AxisRenderer>,
  text: string,
  options: { vertical: boolean; atEnd: boolean }
) => {
  if (!text) return;
  const label = am5.Label.new(root, {
    text: displayText(text),
    fontSize: 12,
    fontWeight: "600",
    fill: TEXT_SECONDARY,
    rotation: options.vertical ? -90 : 0,
    x: options.vertical ? undefined : am5.p50,
    y: options.vertical ? am5.p50 : undefined,
    centerX: am5.p50,
    centerY: options.vertical ? am5.p50 : undefined,
    paddingTop: options.vertical ? 0 : 6,
    oversizedBehavior: "truncate",
    maxWidth: options.vertical ? undefined : 360,
  });
  if (options.atEnd) axis.children.push(label);
  else axis.children.unshift(label);
};

const valueTooltipText = (seriesName: string, valueKey: "valueX" | "valueY", unit: string, showName: boolean) => {
  const value = `{${valueKey}.formatNumber('#,###.######')}`;
  const valueWithUnit = unit === "%" ? `${value}%` : unit ? `${value} ${displayText(unit)}` : value;
  const name = showName ? `${displayText(seriesName)}: ` : "";
  return `[fontSize:11px]{${DISPLAY_LABEL_KEY}}[/]\n${name}[bold]${valueWithUnit}[/]`;
};

const createTooltip = (root: am5.Root, color: am5.Color, orientation: "vertical" | "horizontal") => {
  const tooltip = am5.Tooltip.new(root, {
    pointerOrientation: orientation,
    getFillFromSprite: false,
    getStrokeFromSprite: false,
    autoTextColor: false,
  });
  tooltip.get("background")?.setAll({
    fill: SURFACE,
    fillOpacity: 1,
    stroke: color,
    strokeWidth: 1.5,
    strokeOpacity: 1,
  });
  tooltip.label.setAll({
    fill: TEXT_PRIMARY,
    fontSize: 12,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 10,
    paddingRight: 10,
  });
  return tooltip;
};

/** The unit is on the value axis title when every series shares it; "%" is short enough to repeat. */
const labelUnitFor = (spec: PreparedSeries, model: PreparedChart) =>
  spec.unit === "%" || (spec.unit && !model.unit) ? spec.unit : "";

const longestLabel = (model: PreparedChart) =>
  model.series.reduce((longest, spec) => {
    const unit = labelUnitFor(spec, model);
    return model.rows.reduce((max, row) => {
      const value = row[spec.field];
      if (typeof value !== "number") return max;
      return Math.max(max, withUnit(formatCompactNumber(value), unit).length);
    }, longest);
  }, 0);

/**
 * Draw a column (vertical), bar (horizontal) or line chart from a prepared
 * model. Every series gets its own colour and the legend names them. Arabic
 * charts mirror the layout: first category on the right and the value axis
 * on the right (column, line), or bars growing leftwards (bar).
 */
export const renderCartesianChart = (
  root: am5.Root,
  model: PreparedChart,
  kind: CartesianKind
) => {
  const horizontal = kind === "bar";
  const rtl = model.isRtl;
  const seriesCount = model.series.length;
  const multiSeries = seriesCount > 1;
  const rows: Array<Record<string, unknown>> = model.rows.map((row) => ({
    ...row,
    [DISPLAY_LABEL_KEY]: displayText(String(row[CATEGORY_LABEL_KEY] ?? "")),
  }));
  const total = rows.length;

  root.numberFormatter.setAll({
    bigNumberPrefixes: [
      { number: 1e3, suffix: "K" },
      { number: 1e6, suffix: "M" },
      { number: 1e9, suffix: "B" },
      { number: 1e12, suffix: "T" },
    ],
  });

  const chart = root.container.children.push(
    am5xy.XYChart.new(root, {
      panX: !horizontal,
      panY: horizontal,
      wheelX: "none",
      wheelY: "none",
      pinchZoomX: !horizontal,
      pinchZoomY: horizontal,
      layout: root.verticalLayout,
      paddingTop: 8,
      paddingBottom: 4,
      // Room for the last value-axis tick label of a bar chart.
      paddingLeft: horizontal && rtl ? 18 : 4,
      paddingRight: horizontal && !rtl ? 18 : 4,
    })
  );
  chart.zoomOutButton.set("forceHidden", true);

  // How many categories fit before the chart scrolls.
  const span = horizontal ? Math.max(root.height() - 110, 120) : Math.max(root.width() - 120, 200);
  const minCell =
    kind === "line"
      ? 34
      : horizontal
        ? Math.max(28, seriesCount * 20 + 10)
        : multiSeries
          ? seriesCount * 24 + 18
          : 34;
  const fitCount = Math.max(3, Math.floor(span / minCell));
  const visibleCount = Math.min(total, fitCount);
  const scrolls = total > fitCount;
  const cellSize = span / Math.max(visibleCount, 1);

  // Value labels only where they fit; the tooltip always carries the value.
  const labelWidth = longestLabel(model) * LABEL_CHAR_WIDTH + 4;
  const markWidth = (cellSize * 0.76 * 0.88) / seriesCount;
  const fewMarks = visibleCount * seriesCount <= MAX_LABELLED_MARKS;
  const labelsFit =
    fewMarks &&
    (horizontal || (multiSeries && kind === "column" ? labelWidth <= markWidth + 2 : labelWidth <= cellSize - 4));
  // Clustered columns too narrow for a level label get it upright above the column.
  const uprightLabels = !labelsFit && fewMarks && kind === "column" && markWidth >= 12;
  // Lines with several series label only their last point.
  const endLabelsOnly = kind === "line" && multiSeries;

  // Category axis
  const categoryRenderer = horizontal
    ? am5xy.AxisRendererY.new(root, {
        minGridDistance: 10,
        cellStartLocation: 0.12,
        cellEndLocation: 0.88,
        inversed: true, // first record at the top
        opposite: rtl,
      })
    : am5xy.AxisRendererX.new(root, {
        minGridDistance: 10,
        cellStartLocation: 0.12,
        cellEndLocation: 0.88,
        inversed: rtl,
      });
  categoryRenderer.grid.template.set("forceHidden", true);

  const rotateLabels = !horizontal && cellSize < 72;
  categoryRenderer.labels.template.setAll({
    fill: TEXT_SECONDARY,
    fontSize: 11,
    oversizedBehavior: horizontal || rotateLabels ? "truncate" : "wrap",
    ellipsis: "…",
    maxWidth: horizontal ? 140 : rotateLabels ? 110 : Math.max(cellSize - 8, 40),
    textAlign: horizontal ? (rtl ? "left" : "right") : "center",
    rotation: rotateLabels ? (rtl ? 40 : -40) : 0,
    centerX: rotateLabels ? (rtl ? 0 : am5.p100) : horizontal ? undefined : am5.p50,
    centerY: rotateLabels ? am5.p50 : undefined,
    paddingTop: horizontal ? 0 : 6,
    paddingRight: horizontal && !rtl ? 8 : 0,
    paddingLeft: horizontal && rtl ? 8 : 0,
  });
  categoryRenderer.labels.template.adapters.add("text", (text, target) => {
    const context = target.dataItem?.dataContext as Record<string, unknown> | undefined;
    const label = context?.[DISPLAY_LABEL_KEY];
    return typeof label === "string" ? label : text;
  });

  const categoryAxis = am5xy.CategoryAxis.new(root, {
    categoryField: CATEGORY_KEY,
    renderer: categoryRenderer as any,
  });

  // Value axis
  const valueRenderer = horizontal
    ? am5xy.AxisRendererX.new(root, { minGridDistance: 70, inversed: rtl })
    : am5xy.AxisRendererY.new(root, { minGridDistance: 36, opposite: rtl });
  valueRenderer.grid.template.setAll({ stroke: GRID, strokeOpacity: 1, strokeWidth: 1 });
  valueRenderer.labels.template.setAll({ fill: TEXT_MUTED, fontSize: 11 });
  if (model.unit === "%") {
    valueRenderer.labels.template.adapters.add("text", (text) => (text ? `${text}%` : text));
  }

  const valueAxis = am5xy.ValueAxis.new(root, {
    renderer: valueRenderer as any,
    numberFormat: "#,###.##a",
    extraMax: uprightLabels ? 0.22 : labelsFit || endLabelsOnly ? 0.12 : 0.04,
    extraMin: kind === "line" ? 0.05 : 0,
  });
  // Columns and bars grow from zero.
  if (kind !== "line" && !model.hasNegative) valueAxis.set("min", 0);

  const xAxis = chart.xAxes.push(horizontal ? valueAxis : categoryAxis) as am5xy.Axis<am5xy.AxisRenderer>;
  const yAxis = chart.yAxes.push(horizontal ? categoryAxis : valueAxis) as am5xy.Axis<am5xy.AxisRenderer>;
  categoryAxis.data.setAll(rows);

  // Axis titles: x title under the plot, y title beside its axis.
  const xTitle = horizontal ? model.yAxisTitle : model.xAxisTitle;
  const yTitle = horizontal ? model.xAxisTitle : model.yAxisTitle;
  addAxisTitle(root, xAxis, xTitle, { vertical: false, atEnd: true });
  addAxisTitle(root, yAxis, yTitle, { vertical: true, atEnd: rtl });

  const valueKey = horizontal ? "valueX" : "valueY";

  model.series.forEach((spec) => {
    const color = am5.color(spec.color);
    const name = displayText(spec.name);
    const baseSettings = {
      name,
      xAxis: xAxis as any,
      yAxis: yAxis as any,
      fill: color,
      stroke: color,
      ...(horizontal
        ? { valueXField: spec.field, categoryYField: CATEGORY_KEY }
        : { valueYField: spec.field, categoryXField: CATEGORY_KEY }),
    };
    const tooltip = createTooltip(root, color, horizontal ? "horizontal" : "vertical");
    const tooltipText = valueTooltipText(spec.name, valueKey, spec.unit, multiSeries);

    const series =
      kind === "line"
        ? chart.series.push(am5xy.LineSeries.new(root, { ...baseSettings, connect: false, tooltip, maskBullets: !endLabelsOnly }))
        : chart.series.push(
            am5xy.ColumnSeries.new(root, { ...baseSettings, clustered: true, sequencedInterpolation: true })
          );

    if (series instanceof am5xy.LineSeries) {
      tooltip.set("labelText", tooltipText);
      series.strokes.template.setAll({ strokeWidth: 2 });
      if (!multiSeries) {
        series.fills.template.setAll({ visible: true, fillOpacity: 0.1 });
      }
      series.bullets.push(() =>
        am5.Bullet.new(root, {
          sprite: am5.Circle.new(root, { radius: 4, fill: color, stroke: SURFACE, strokeWidth: 2 }),
        })
      );
    } else {
      const columnSeries = series as am5xy.ColumnSeries;
      columnSeries.set("tooltip", tooltip);
      columnSeries.columns.template.setAll({
        tooltipText,
        strokeOpacity: 0,
        width: am5.percent(88),
        height: am5.percent(88),
        ...(horizontal
          ? {
              maxHeight: 24,
              cornerRadiusTR: rtl ? 0 : 4,
              cornerRadiusBR: rtl ? 0 : 4,
              cornerRadiusTL: rtl ? 4 : 0,
              cornerRadiusBL: rtl ? 4 : 0,
            }
          : { maxWidth: 36, cornerRadiusTL: 4, cornerRadiusTR: 4, cornerRadiusBL: 0, cornerRadiusBR: 0 }),
      });
      columnSeries.columns.template.states.create("hover", {
        fill: am5.Color.brighten(color, 0.15),
      });
    }

    if (labelsFit || uprightLabels || endLabelsOnly) {
      const unit = labelUnitFor(spec, model);
      const lastRow = [...rows].reverse().find((row) => typeof row[spec.field] === "number");
      (series as am5xy.XYSeries).bullets.push((_root, _series, dataItem) => {
        if (endLabelsOnly && dataItem.dataContext !== lastRow) return undefined;
        const raw = (dataItem as am5.DataItem<am5xy.IXYSeriesDataItem>).get(valueKey) as number | undefined;
        if (raw === undefined || raw === null) return undefined;
        const negative = Number(raw) < 0;
        const label = am5.Label.new(root, {
          text: withUnit(formatCompactNumber(Number(raw)), unit),
          populateText: false,
          fill: TEXT_PRIMARY,
          fontSize: 10.5,
          fontWeight: "600",
          oversizedBehavior: "none",
          ...(horizontal
            ? {
                centerY: am5.p50,
                centerX: (rtl ? !negative : negative) ? am5.p100 : 0,
                dx: (rtl ? !negative : negative) ? -4 : 4,
              }
            : endLabelsOnly
              ? { centerY: am5.p50, centerX: rtl ? am5.p100 : 0, dx: rtl ? -8 : 8 }
              : uprightLabels
                ? { rotation: -90, centerY: am5.p50, centerX: negative ? am5.p100 : 0, dy: negative ? 4 : -4 }
                : { centerX: am5.p50, centerY: negative ? 0 : am5.p100, dy: negative ? 4 : -4 }),
        });
        if (kind === "line") return am5.Bullet.new(root, { sprite: label });
        return am5.Bullet.new(root, {
          locationX: horizontal ? 1 : 0.5,
          locationY: horizontal ? 0.5 : 1,
          sprite: label,
        });
      });
    }

    series.data.setAll(rows);
    series.appear(800);
  });

  if (endLabelsOnly) {
    // Room for the end labels beside the last point.
    chart.set(rtl ? "paddingLeft" : "paddingRight", 44);
  }

  if (multiSeries) {
    const legend = chart.children.unshift(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        paddingBottom: 6,
        layout: am5.GridLayout.new(root, { maxColumns: 4, fixedWidthGrid: false }),
      })
    );
    legend.markers.template.setAll({ width: 12, height: 12 });
    legend.markerRectangles.template.setAll({
      cornerRadiusTL: 3,
      cornerRadiusTR: 3,
      cornerRadiusBL: 3,
      cornerRadiusBR: 3,
    });
    legend.labels.template.setAll({ fill: TEXT_SECONDARY, fontSize: 12 });
    legend.valueLabels.template.set("forceHidden", true);
    legend.data.setAll(rtl ? [...chart.series.values].reverse() : chart.series.values);
  }

  if (kind === "line") {
    const cursor = chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "none", xAxis: categoryAxis as any }));
    cursor.lineY.set("forceHidden", true);
    cursor.lineX.setAll({ stroke: GRID, strokeOpacity: 1, strokeDasharray: [] });
  }

  if (scrolls) {
    const scrollbar = am5.Scrollbar.new(root, {
      orientation: horizontal ? "vertical" : "horizontal",
      ...(horizontal ? { width: 8, marginLeft: 6, marginRight: 6 } : { height: 8, marginTop: 6 }),
    });
    if (horizontal) chart.set("scrollbarY", scrollbar);
    else chart.set("scrollbarX", scrollbar);
    // Keep the scrollbar on the side away from the category labels.
    if (horizontal) (rtl ? chart.leftAxesContainer : chart.rightAxesContainer).children.push(scrollbar);
    else chart.bottomAxesContainer.children.push(scrollbar);
    scrollbar.thumb.setAll({ fill: am5.color(0xd1d5db), fillOpacity: 1 });
    scrollbar.get("background")?.setAll({ fill: am5.color(0xf3f4f6), fillOpacity: 1 });
    scrollbar.startGrip.set("forceHidden", true);
    scrollbar.endGrip.set("forceHidden", true);

    const end = visibleCount / total;
    categoryAxis.events.once("datavalidated", () => {
      categoryAxis.zoom(0, end);
    });
  }

  chart.appear(800, 100);
  return chart;
};
