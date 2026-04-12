"use client";

import dynamic from "next/dynamic";
import { LineChart } from "lucide-react";
import { Card } from "@/components/ui/card";

const SmartGraphMap = dynamic(() => import("@/components/SmartGraph"), {
  ssr: false,
  loading: () => (
    <div className="h-[800px] w-full flex items-center justify-center animate-pulse bg-muted/40 rounded-2xl border border-border">
      Loading Graph Engine...
    </div>
  ),
});

export default function SmartGraphPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-2">
            Smart Knowledge Graph
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            A real-time network visualization mapping relationships between companies, their ecosystems, market sentiment, and macroeconomic lagging indicators.
          </p>
        </div>
        <div className="flex gap-3">
          <Card className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-primary/20 shadow-sm">
            <LineChart className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">Live Data</span>
          </Card>
        </div>
      </div>

      <div className="w-full">
        <SmartGraphMap />
      </div>
      
      <div className="pt-2 text-xs text-center text-muted-foreground">
        Engineered with Neo4j · cytoscape.js · Technical Indicators · yfinance
      </div>
    </div>
  );
}
