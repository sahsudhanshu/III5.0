"use client";

import React, { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, Time, CandlestickSeries, AreaSeries, HistogramSeries } from "lightweight-charts";
import { useTheme } from "next-themes";
import type { CandlestickDataPoint } from "@/types";

interface TradingChartProps {
  data: CandlestickDataPoint[];
  type: "candlestick" | "line" | "area";
  height?: number;
}

export function TradingChart({ data, type, height = 400 }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick" | "Line" | "Area"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Determine colors based on theme
    const isDark = resolvedTheme === "dark";
    const backgroundColor = isDark ? "transparent" : "transparent";
    const textColor = isDark ? "hsl(215 20.2% 65.1%)" : "hsl(215.4 16.3% 46.9%)";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
    
    const upColor = "#22c55e"; // Green for up
    const downColor = "#ef4444"; // Red for down

    const chartInfo = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
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
        scaleMargins: {
          top: 0.1,
          bottom: 0.25, // Leave space for volume
        },
      },
      crosshair: {
        mode: 1, // Magnet crosshair
        vertLine: { width: 1, color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)", style: 3 },
        horzLine: { width: 1, color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)", style: 3 },
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

    chartRef.current = chartInfo;

    // Create Main Series
    if (type === "candlestick") {
      seriesRef.current = chartInfo.addSeries(CandlestickSeries, {
        upColor,
        downColor,
        borderVisible: false,
        wickUpColor: upColor,
        wickDownColor: downColor,
      });
    } else {
      seriesRef.current = chartInfo.addSeries(AreaSeries, {
        lineColor: upColor,
        topColor: isDark ? "rgba(34, 197, 94, 0.2)" : "rgba(34, 197, 94, 0.2)",
        bottomColor: isDark ? "rgba(34, 197, 94, 0)" : "rgba(34, 197, 94, 0)",
        lineWidth: 2,
      });
    }

    // Create Volume Series
    volumeSeriesRef.current = chartInfo.addSeries(HistogramSeries, {
      color: "rgba(34, 197, 94, 0.3)",
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "", // Set as an overlay scale
    });

    chartInfo.priceScale("").applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    return () => {
      chartInfo.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [type, resolvedTheme, height]);

  // Data update
  useEffect(() => {
    if (!seriesRef.current || !volumeSeriesRef.current || !data.length) return;

    // Convert ISO string data dynamically to valid UNIX timestamp (seconds)
    const formattedData = [...data].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()).map(d => {
      const timeVal = Math.floor(new Date(d.time).getTime() / 1000) as Time;
      return {
        ...d,
        time: timeVal,
      };
    });

    if (type === "candlestick") {
      (seriesRef.current as ISeriesApi<"Candlestick">).setData(formattedData);
    } else {
      // Area/Line expects standard { time, value } structure
      const lineData = formattedData.map(d => ({
        time: d.time,
        value: d.close, 
      }));
      (seriesRef.current as ISeriesApi<"Area">).setData(lineData);
      
      // Update color based on general trend if line/area chart
      const firstClose = lineData[0]?.value || 0;
      const lastClose = lineData[lineData.length - 1]?.value || 0;
      const upColor = "#22c55e";
      const downColor = "#ef4444";
      const color = lastClose >= firstClose ? upColor : downColor;
      
      (seriesRef.current as ISeriesApi<"Area">).applyOptions({
        lineColor: color,
        topColor: `rgba(${color === upColor ? "34, 197, 94" : "239, 68, 68"}, 0.2)`,
        bottomColor: `rgba(${color === upColor ? "34, 197, 94" : "239, 68, 68"}, 0)`,
      });
    }

    // Add Volume Data
    const volumeData = formattedData.map(d => {
      const isUp = d.close >= d.open;
      return {
        time: d.time,
        value: d.volume,
        color: isUp ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)",
      };
    });
    volumeSeriesRef.current.setData(volumeData);

    chartRef.current?.timeScale().setVisibleLogicalRange({
      from: -0.5,
      to: formattedData.length - 0.5,
    });
  }, [data, type]);

  // Resize handling
  useEffect(() => {
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="w-full relative group">
      <div 
         ref={chartContainerRef} 
         className="w-full" 
         style={{ height }}
      />
    </div>
  );
}
