/**
 * Chart payload contract and the pure data preparation shared by the column,
 * bar and line charts. Nothing here touches amCharts, so the same prepared
 * model is plotted whichever chart type the user switches to.
 *
 * Payload (`chartData`) sent by the chart tool workflow:
 *
 *   {
 *     data:   [{ month: "Jan", budget: 120, actual: 95 }, ...],
 *     xField: "month",                 // category / time field
 *     yField: "budget",                // first measure (single-series payloads)
 *     series: [                        // one entry per measure
 *       { name: "Budget", valueYField: "budget", categoryXField: "month", unit: "AED" },
 *       { name: "Actual", valueYField: "actual", categoryXField: "month", unit: "AED" }
 *     ],
 *     title?: "Budget vs actual, 2025",
 *     subtitle?: "Source: uploaded CSV",
 *     xAxisTitle?: "Month",
 *     yAxisTitle?: "Amount",
 *     unit?: "AED"                     // shared unit when every series has the same one
 *   }
 *
 * Older single-series payloads have no `title`, and their only series `name`
 * is the chart title. Those still render the same way.
 */

export interface ChartSeriesSpec {
  name?: string;
  valueYField?: string;
  categoryXField?: string;
  type?: string;
  unit?: string;
  h2?: string;
}

export interface ChartPayload {
  data?: Array<Record<string, unknown>>;
  xField?: string;
  yField?: string;
  series?: ChartSeriesSpec[];
  title?: string;
  subtitle?: string;
  xAxisTitle?: string;
  yAxisTitle?: string;
  unit?: string;
}

export interface PreparedSeries {
  field: string;
  name: string;
  unit: string;
  color: string;
}

export interface PreparedChart {
  /** One row per category cell, keyed by CATEGORY_KEY, with numeric series fields. */
  rows: Array<Record<string, unknown>>;
  series: PreparedSeries[];
  title: string;
  subtitle: string;
  xAxisTitle: string;
  yAxisTitle: string;
  /** Unit shared by every series, or "" when they differ or have none. */
  unit: string;
  isRtl: boolean;
  hasNegative: boolean;
}

/** Unique category key per plotted cell (amCharts merges equal category values). */
export const CATEGORY_KEY = "__category";
/** The label shown for a cell; equal to the source category text. */
export const CATEGORY_LABEL_KEY = "__label";

/**
 * Series colours in fixed order (brand gold first). Validated with the dataviz
 * palette checker on a white surface: adjacent CVD ΔE 17.6, first three
 * all-pairs ΔE 8.0. Aqua and magenta are under 3:1 contrast, so charts keep
 * value labels and tooltips on.
 */
export const CHART_SERIES_COLORS = [
  "#B68A35",
  "#2a78d6",
  "#1baf7a",
  "#4a3aa7",
  "#e87ba4",
  "#008300",
];

const DUPLICATE_SEPARATOR = "\u2063";
const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export const hasArabicText = (value: unknown) => ARABIC_SCRIPT.test(String(value ?? ""));

const MULTIPLIERS: Array<[RegExp, number]> = [
  [/^(bn|b|billion|مليار)$/i, 1e9],
  [/^(mn|m|million|مليون)$/i, 1e6],
  [/^(k|thousand|ألف|الف)$/i, 1e3],
];

export interface ParsedNumber {
  value?: number;
  percent: boolean;
}

/**
 * Turn a cell value into a number. AI output in Arabic may carry Arabic or
 * Persian digits and separators (١٬٢٠٠٫٥), a percent sign (٨٥٪, 85%),
 * thousands commas, a unit or currency, or a scale word (1.2M, 3 مليون).
 */
export const parseChartNumber = (raw: unknown): ParsedNumber => {
  if (typeof raw === "number") {
    return { value: Number.isFinite(raw) ? raw : undefined, percent: false };
  }
  if (raw === null || raw === undefined || typeof raw === "boolean" || typeof raw === "object") {
    return { value: undefined, percent: false };
  }

  let text = String(raw)
    .trim()
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/٬/g, ",")
    .replace(/٫/g, ".")
    .replace(/٪/g, "%")
    .replace(/[−‒–]/g, "-")
    .replace(/[‎‏؜ ]/g, " ");

  const percent = text.includes("%");
  const negativeByParens = /^\(.*\)$/.test(text);

  const match = text.match(/-?\d[\d,]*(?:\.\d+)?|-?\.\d+/);
  if (!match) return { value: undefined, percent };

  let token = match[0];
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(token)) {
    token = token.replace(/,/g, "");
  } else if (/^-?\d+,\d+$/.test(token)) {
    token = token.replace(",", ".");
  } else {
    token = token.replace(/,/g, "");
  }

  let value = Number(token);
  if (!Number.isFinite(value)) return { value: undefined, percent };

  const after = text.slice((match.index ?? 0) + match[0].length).trim();
  const scaleWord = after.split(/[\s)%]/)[0] ?? "";
  const multiplier = MULTIPLIERS.find(([pattern]) => pattern.test(scaleWord))?.[1];
  if (multiplier) value *= multiplier;
  if (negativeByParens && value > 0) value = -value;

  return { value, percent };
};

/** Kept for the non-cartesian renderers. */
export const toFiniteNumber = (value: unknown) => parseChartNumber(value).value;

const looseKey = (key: string) => key.toLowerCase().replace(/[\s_\-.]/g, "");

const resolveDataField = (
  rows: Array<Record<string, unknown>>,
  candidates: Array<string | undefined>
) => {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row ?? {}))));
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (keys.includes(candidate)) return candidate;
    const lower = keys.find((key) => key.toLowerCase() === candidate.toLowerCase());
    if (lower) return lower;
    const loose = keys.find((key) => looseKey(key) === looseKey(candidate));
    if (loose) return loose;
  }
  return undefined;
};

const isNumericColumn = (rows: Array<Record<string, unknown>>, key: string) => {
  const filled = rows.filter((row) => row[key] !== null && row[key] !== undefined && row[key] !== "");
  if (!filled.length) return false;
  const numeric = filled.filter((row) => parseChartNumber(row[key]).value !== undefined);
  return numeric.length / filled.length >= 0.8;
};

/** "total_amount" -> "Total amount", "budgetAmount" -> "Budget amount". */
export const humanizeFieldName = (field: string) => {
  const spaced = field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return "";
  const lower = /[A-Z]{2,}/.test(spaced) ? spaced : spaced.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const cleanText = (value: unknown) =>
  typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();

/** Title and subtitle shown above the chart. */
export const getChartHeading = (payload: ChartPayload | undefined | null) => {
  const specs = Array.isArray(payload?.series) ? payload!.series! : [];
  const explicit = cleanText(payload?.title);
  let title = explicit;
  if (!title && specs.length === 1) title = cleanText(specs[0]?.name);
  if (!title && specs.length > 1) {
    title = specs.map((spec) => cleanText(spec.name)).filter(Boolean).join(" vs ");
  }
  const subtitle = cleanText(payload?.subtitle) || cleanText(specs[0]?.h2);
  return { title, subtitle };
};

export const prepareCartesianChart = (payload: ChartPayload | undefined | null): PreparedChart | undefined => {
  if (!payload || !Array.isArray(payload.data)) return undefined;
  const sourceRows = payload.data.filter(
    (row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row)
  );
  if (!sourceRows.length) return undefined;

  const specs: ChartSeriesSpec[] =
    Array.isArray(payload.series) && payload.series.length
      ? payload.series
      : [{ valueYField: payload.yField }];

  const allKeys = Array.from(new Set(sourceRows.flatMap((row) => Object.keys(row))));
  const xField =
    resolveDataField(sourceRows, [specs[0]?.categoryXField, payload.xField]) ??
    allKeys.find((key) => !isNumericColumn(sourceRows, key)) ??
    allKeys[0];
  if (!xField) return undefined;

  const isLegacySingleSeries = !cleanText(payload.title) && specs.length === 1;
  const seriesFields: Array<{ field: string; spec?: ChartSeriesSpec }> = [];
  specs.forEach((spec, index) => {
    const field = resolveDataField(sourceRows, [
      spec?.valueYField,
      index === 0 ? payload.yField : undefined,
    ]);
    if (!field || field === xField || seriesFields.some((s) => s.field === field)) return;
    seriesFields.push({ field, spec });
  });

  // The requested measure is missing from the rows (for example the agent
  // named it in English but wrote Arabic keys): plot every numeric column.
  if (!seriesFields.length) {
    allKeys
      .filter((key) => key !== xField && isNumericColumn(sourceRows, key))
      .forEach((field) => seriesFields.push({ field }));
  }
  if (!seriesFields.length) return undefined;

  // Parse values and detect percent per series.
  const percentSeen = new Map<string, { strings: number; percents: number }>();
  const parsedRows = sourceRows.map((row) => {
    const label = cleanText(row[xField]);
    const values: Record<string, number | undefined> = {};
    seriesFields.forEach(({ field }) => {
      const raw = row[field];
      const parsed = parseChartNumber(raw);
      values[field] = parsed.value;
      if (typeof raw === "string" && parsed.value !== undefined) {
        const seen = percentSeen.get(field) ?? { strings: 0, percents: 0 };
        seen.strings += 1;
        if (parsed.percent) seen.percents += 1;
        percentSeen.set(field, seen);
      }
    });
    return { label, values };
  });

  // Merge rows that repeat a category with values for other measures (long
  // format). Rows that repeat a category with a different value for the same
  // measure stay separate cells, so no value is summed or dropped.
  const cells: Array<{ label: string; values: Record<string, number | undefined> }> = [];
  parsedRows.forEach(({ label, values }) => {
    const hasValue = Object.values(values).some((value) => value !== undefined);
    if (!hasValue) return;
    const target = cells.find(
      (cell) =>
        cell.label === label &&
        seriesFields.every(({ field }) => {
          const current = cell.values[field];
          const next = values[field];
          return current === undefined || next === undefined || current === next;
        })
    );
    if (target) {
      seriesFields.forEach(({ field }) => {
        if (target.values[field] === undefined) target.values[field] = values[field];
      });
    } else {
      cells.push({ label, values: { ...values } });
    }
  });
  if (!cells.length) return undefined;

  const labelCounts = new Map<string, number>();
  const rows = cells.map(({ label, values }) => {
    const seen = labelCounts.get(label) ?? 0;
    labelCounts.set(label, seen + 1);
    const row: Record<string, unknown> = {
      [CATEGORY_KEY]: seen === 0 ? label : `${label}${DUPLICATE_SEPARATOR}${seen + 1}`,
      [CATEGORY_LABEL_KEY]: label,
    };
    seriesFields.forEach(({ field }) => {
      if (values[field] !== undefined) row[field] = values[field];
    });
    return row;
  });

  const payloadUnit = cleanText(payload.unit);
  const series: PreparedSeries[] = seriesFields.map(({ field, spec }, index) => {
    const seen = percentSeen.get(field);
    const detectedUnit = seen && seen.strings > 0 && seen.percents === seen.strings ? "%" : "";
    const specName = cleanText(spec?.name);
    return {
      field,
      // A legacy single-series name is the chart title, not a measure name.
      name: (isLegacySingleSeries ? "" : specName) || humanizeFieldName(field) || field,
      unit: cleanText(spec?.unit) || payloadUnit || detectedUnit,
      color: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length],
    };
  });

  const unit = series.every((s) => s.unit === series[0].unit) ? series[0].unit : "";
  const { title, subtitle } = getChartHeading(payload);
  const xAxisTitle = cleanText(payload.xAxisTitle) || humanizeFieldName(xField);
  const baseYTitle =
    cleanText(payload.yAxisTitle) || (series.length === 1 ? humanizeFieldName(series[0].field) : "");
  const yAxisTitle = unit && baseYTitle && !baseYTitle.includes(unit) ? `${baseYTitle} (${unit})` : baseYTitle;

  const labels = rows.map((row) => String(row[CATEGORY_LABEL_KEY]));
  const arabicLabels = labels.filter(hasArabicText).length;
  const isRtl = hasArabicText(title) || arabicLabels * 2 >= labels.length;

  const hasNegative = rows.some((row) =>
    series.some((s) => typeof row[s.field] === "number" && (row[s.field] as number) < 0)
  );

  return {
    rows,
    series,
    title,
    subtitle,
    xAxisTitle,
    yAxisTitle,
    unit,
    isRtl,
    hasNegative,
  };
};

/** Compact number for data labels and axis ticks: 1,250 -> 1.25K. */
export const formatCompactNumber = (value: number) => {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const scales: Array<[number, string]> = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of scales) {
    if (abs >= size) {
      const scaled = abs / size;
      const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
      return `${sign}${Number(scaled.toFixed(digits))}${suffix}`;
    }
  }
  return `${sign}${Number(abs.toFixed(abs >= 100 ? 0 : 2))}`;
};

/** Full-precision number for tooltips: 1250000.5 -> 1,250,000.5. */
export const formatExactNumber = (value: number) =>
  Number.isFinite(value) ? value.toLocaleString("en-US", { maximumFractionDigits: 6 }) : "";

export const withUnit = (text: string, unit: string) => {
  if (!text || !unit) return text;
  return unit === "%" ? `${text}%` : `${text} ${unit}`;
};
