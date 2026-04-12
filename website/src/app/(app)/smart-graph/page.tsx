'use client';

import dynamic from 'next/dynamic';
import { LineChart } from 'lucide-react';
import { Card } from '@/components/ui/card';

const SmartGraphMap = dynamic(() => import('@/components/SmartGraph'), { ssr: false, loading: () => <div className="h-[800px] w-full flex items-center justify-center animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl">Loading Graph Engine...</div> });

export default function SmartGraphPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">Smart Knowledge Graph</h1>
          <p className="text-slate-500 max-w-2xl">
            A real-time network visualization mapping relationships between companies, their ecosystems, market sentiment, and macroeconomic lagging indicators.
          </p>
        </div>
        <div className="flex gap-3">
            <Card className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-none shadow-sm">
                <LineChart className="w-5 h-5 text-indigo-600" />
                <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Live Data</span>
            </Card>
        </div>
      </div>

      <div className="w-full">
        <SmartGraphMap />
      </div>
      
      <div className="pt-4 text-xs text-center text-slate-400">
        Engineered with Neo4j · cytoscape.js · Technical Indicators · yfinance
      </div>
    </div>
  );
}
