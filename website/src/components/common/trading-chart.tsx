"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  Time,
  CandlestickSeries,
  AreaSeries,
  HistogramSeries,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import type { CandlestickDataPoint } from "@/types";
import {
  Bot,
  X,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
} from "lucide-react";

interface TradingChartProps {
  data: CandlestickDataPoint[];
  type: "candlestick" | "line" | "area";
  height?: number;
  symbol?: string;
  timeframe?: string;
}

interface CandleDetail {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PointAnalysis {
  date: string;
  movement_type: string;
  pct_change: number;
  analysis: string;
  candle?: CandleDetail;
  ma5?: number;
  ma20?: number;
  vol_ratio?: number;
}

interface PopoverState {
  visible: boolean;
  x: number;
  y: number;
  loading: boolean;
  result: PointAnalysis | null;
  error: string | null;
}

const POPOVER_W = 368; // px — must match w-[368px] below
const POPOVER_H = 340; // px estimated max height for flip logic

export function TradingChart({
  data,
  type,
  height = 400,
  symbol = "STOCK",
  timeframe = "1D",
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick" | "Line" | "Area"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const formattedDataRef = useRef<(CandlestickDataPoint & { time: number })[]>([]);

  const { resolvedTheme } = useTheme();
  const [popover, setPopover] = useState<PopoverState>({
    visible: false,
    x: 0,
    y: 0,
    loading: false,
    result: null,
    error: null,
  });

  // ── Smart position — keep popover inside its container ──────────────────────
  function computePosition(rawX: number, rawY: number): { x: number; y: number } {
    const containerW = chartContainerRef.current?.clientWidth ?? 800;

    // Flip horizontally if the popover would overflow the right edge
    let x = rawX + 16;
    if (x + POPOVER_W > containerW) {
      x = rawX - POPOVER_W - 16;
    }
    // Keep x in-bounds
    x = Math.max(8, Math.min(x, containerW - POPOVER_W - 8));

    // Place below cursor; flip up if too close to bottom
    let y = rawY + 16;
    if (y + POPOVER_H > height) {
      y = rawY - POPOVER_H - 16;
    }
    y = Math.max(8, y);

    return { x, y };
  }

  // ── Fetch AI analysis for a clicked date ────────────────────────────────────
  const analyzePoint = useCallback(
    async (date: string, rawX: number, rawY: number) => {
      const { x, y } = computePosition(rawX, rawY);
      setPopover({ visible: true, x, y, loading: true, result: null, error: null });

      try {
        const res = await fetch("http://127.0.0.1:8000/api/analyze-point", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, timeframe, date }),
        });
        const json = await res.json();
        if (json.error && !json.analysis) throw new Error(json.error);
        setPopover((p) => ({ ...p, loading: false, result: json as PointAnalysis }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to analyze";
        setPopover((p) => ({ ...p, loading: false, error: msg }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symbol, timeframe]
  );

  // ── Chart initialisation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const isDark = resolvedTheme === "dark";
    const textColor = isDark ? "hsl(215 20.2% 65.1%)" : "hsl(215.4 16.3% 46.9%)";
    const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
    const upColor = "#22c55e";
    const downColor = "#ef4444";

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor,
        fontFamily: "'Inter', sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      width: chartContainerRef.current.clientWidth,
      height,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
          style: 3,
        },
        horzLine: {
          width: 1,
          color: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
          style: 3,
        },
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: false,
        horzTouchDrag: false,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: false,
        mouseWheel: false,
        pinch: false,
      },
    });

    chartRef.current = chart;

    // Add main series
    if (type === "candlestick") {
      seriesRef.current = chart.addSeries(CandlestickSeries, {
        upColor,
        downColor,
        borderVisible: false,
        wickUpColor: upColor,
        wickDownColor: downColor,
      });
    } else {
      seriesRef.current = chart.addSeries(AreaSeries, {
        lineColor: upColor,
        topColor: "rgba(34,197,94,0.18)",
        bottomColor: "rgba(34,197,94,0)",
        lineWidth: 2,
      });
    }

    // Add volume histogram
    volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
      color: "rgba(34,197,94,0.28)",
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    chart.priceScale("").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    // ── Click handler — capture pixel coords from param.point ──
    chart.subscribeClick((param) => {
      if (!param.point || !param.time) return;

      const fd = formattedDataRef.current;
      const clickedTime = param.time as number;
      const found = fd.find((d) => d.time === clickedTime);
      if (!found) return;

      const date = new Date(found.time * 1000).toISOString().split("T")[0];

      // param.point gives pixel coords relative to the chart canvas
      analyzePoint(date, param.point.x, param.point.y);
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [type, resolvedTheme, height, analyzePoint]);

  // ── Data update ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current || !volumeSeriesRef.current || !data.length) return;

    const formattedData = [...data]
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
      .map((d) => ({
        ...d,
        time: Math.floor(new Date(d.time).getTime() / 1000) as unknown as number,
      })) as (CandlestickDataPoint & { time: number })[];

    formattedDataRef.current = formattedData;

    const fd = formattedData as unknown as (CandlestickDataPoint & { time: Time })[];

    if (type === "candlestick") {
      (seriesRef.current as ISeriesApi<"Candlestick">).setData(fd);
    } else {
      const lineData = fd.map((d) => ({ time: d.time, value: d.close }));
      (seriesRef.current as ISeriesApi<"Area">).setData(lineData);
      const firstClose = lineData[0]?.value || 0;
      const lastClose = lineData[lineData.length - 1]?.value || 0;
      const isUp = lastClose >= firstClose;
      (seriesRef.current as ISeriesApi<"Area">).applyOptions({
        lineColor: isUp ? "#22c55e" : "#ef4444",
        topColor: isUp ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)",
        bottomColor: isUp ? "rgba(34,197,94,0)" : "rgba(239,68,68,0)",
      });
    }

    const volumeData = fd.map((d) => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? "rgba(34,197,94,0.38)" : "rgba(239,68,68,0.38)",
    }));
    volumeSeriesRef.current.setData(volumeData);
    chartRef.current
      ?.timeScale()
      .setVisibleLogicalRange({ from: -0.5, to: formattedData.length - 0.5 });
  }, [data, type]);

  // ── Resize observer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      chartRef.current?.applyOptions({ width: entries[0].contentRect.width });
      if (data?.length) {
        chartRef.current
          ?.timeScale()
          .setVisibleLogicalRange({ from: -0.5, to: data.length - 0.5 });
      }
    });
    ro.observe(chartContainerRef.current);
    return () => ro.disconnect();
  }, [data]);

  // ── Derived display values ───────────────────────────────────────────────────
  const pct = popover.result?.pct_change ?? 0;
  const MovementIcon =
    pct > 0.5 ? TrendingUp : pct < -0.5 ? TrendingDown : Minus;
  const movementColor =
    pct > 0.5
      ? "text-green-500"
      : pct < -0.5
        ? "text-red-500"
        : "text-muted-foreground";

  // Parse AI bullet points
  const bulletLines =
    popover.result?.analysis
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0) ?? [];

  return (
    <div className="w-full relative group">
      {/* Chart canvas */}
      <div
        ref={chartContainerRef}
        className="w-full cursor-crosshair"
        style={{ height }}
      />

      {/* Subtle click-hint badge */}
      {!popover.visible && (
        <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground/50 pointer-events-none flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Bot className="w-3 h-3" />
          Click any point for AI analysis
        </div>
      )}

      {/* ── Analysis Popover ── */}
      {popover.visible && (
        <div
          className="absolute z-50 w-[368px] rounded-2xl overflow-hidden shadow-2xl border border-border/80 bg-card backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{ left: popover.x, top: popover.y }}
        >
          {/* ── Header ── */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border/60">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              {popover.result ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold min-w-0 flex-wrap">
                  <span className="text-primary font-mono">{symbol}</span>
                  <span className="text-muted-foreground font-normal">
                    {popover.result.date}
                  </span>
                  <MovementIcon className={`w-3 h-3 ${movementColor} flex-shrink-0`} />
                  <span className={`${movementColor} font-mono`}>
                    {pct > 0 ? "+" : ""}
                    {pct.toFixed(2)}%
                  </span>
                  <span className="text-muted-foreground font-normal italic truncate">
                    {popover.result.movement_type}
                  </span>
                </span>
              ) : (
                <span className="text-xs font-semibold text-muted-foreground">
                  Analyzing {symbol}…
                </span>
              )}
            </div>
            <button
              onClick={() => setPopover((p) => ({ ...p, visible: false }))}
              className="ml-1 flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors rounded-md p-0.5 hover:bg-muted"
              aria-label="Close analysis"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="p-3 max-h-[280px] overflow-y-auto space-y-3">
            {/* Loading state */}
            {popover.loading && (
              <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-xs">
                  Fetching real market data &amp; generating analysis…
                </span>
              </div>
            )}

            {/* Error state */}
            {popover.error && !popover.loading && (
              <p className="text-xs text-red-500 py-2">⚠️ {popover.error}</p>
            )}

            {/* Success state */}
            {popover.result && !popover.loading && (
              <>
                {/* OHLCV + indicators grid */}
                {popover.result.candle && (
                  <div className="rounded-xl bg-muted/40 border border-border/50 overflow-hidden">
                    <div className="grid grid-cols-4 gap-0 divide-x divide-border/40">
                      {[
                        { label: "O", value: popover.result.candle.open, color: "" },
                        {
                          label: "H",
                          value: popover.result.candle.high,
                          color: "text-green-500",
                        },
                        {
                          label: "L",
                          value: popover.result.candle.low,
                          color: "text-red-500",
                        },
                        { label: "C", value: popover.result.candle.close, color: "" },
                      ].map(({ label, value, color }) => (
                        <div
                          key={label}
                          className="flex flex-col items-center py-1.5 px-1"
                        >
                          <span className="text-[9px] text-muted-foreground font-medium">
                            {label}
                          </span>
                          <span
                            className={`text-[11px] font-mono font-semibold ${color || "text-foreground"}`}
                          >
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* MA / Volume row */}
                    <div className="grid grid-cols-3 divide-x divide-border/40 border-t border-border/40 bg-muted/20">
                      <div className="flex flex-col items-center py-1 px-1">
                        <span className="text-[9px] text-muted-foreground">MA5</span>
                        <span className="text-[10px] font-mono font-semibold text-primary">
                          {popover.result.ma5}
                        </span>
                      </div>
                      <div className="flex flex-col items-center py-1 px-1">
                        <span className="text-[9px] text-muted-foreground">MA20</span>
                        <span className="text-[10px] font-mono font-semibold text-primary">
                          {popover.result.ma20}
                        </span>
                      </div>
                      <div className="flex flex-col items-center py-1 px-1">
                        <span className="text-[9px] text-muted-foreground">Vol×</span>
                        <span
                          className={`text-[10px] font-mono font-semibold ${(popover.result.vol_ratio ?? 1) > 1.2
                              ? "text-green-500"
                              : (popover.result.vol_ratio ?? 1) < 0.8
                                ? "text-red-500"
                                : "text-foreground"
                            }`}
                        >
                          {popover.result.vol_ratio}×
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI bullet points */}
                <div className="space-y-1.5">
                  {bulletLines.map((line, i) => (
                    <div key={i} className="flex gap-2 text-[11px] leading-snug">
                      <span className="text-primary mt-0.5 flex-shrink-0">
                        {line.startsWith("•") || line.startsWith("-") ? "" : "•"}
                      </span>
                      <span className="text-foreground/90">{line.replace(/^[•\-]\s*/, "")}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Footer watermark ── */}
          {/* <div className="px-4 py-1.5 bg-muted/30 border-t border-border/40 flex items-center gap-1">
            <Bot className="w-2.5 h-2.5 text-muted-foreground/60" />
            <span className="text-[9px] text-muted-foreground/60">
              Powered by Aria trading agent · real yfinance data
            </span>
          </div> */}
        </div>
      )}
    </div>
  );
}
