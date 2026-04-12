'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import cytoscape from 'cytoscape';
import CytoscapeComponent from 'react-cytoscapejs';
import { Card } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Bot, LineChart, AlertCircle, Send, Sparkles, MessageSquare, X } from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────────────────────
/** Map a Pearson coefficient to a hex colour (green = positive, red = negative). */
function correlationColor(pearson: number): string {
  const abs = Math.min(Math.abs(pearson), 1);
  const intensity = Math.round(80 + abs * 175); // 80–255
  if (pearson >= 0) return `rgb(16, ${intensity}, 80)`;           // green spectrum
  return `rgb(${intensity}, 40, 60)`;                              // red spectrum
}

/** Map correlation abs_avg to edge width (1–8px). */
function correlationWidth(absAvg: number): number {
  return Math.max(1, Math.round(absAvg * 8));
}

// ── Types ──────────────────────────────────────────────────────────────────
interface GraphNodeData {
  _type: 'node';
  id: string;
  ticker?: string;
  name?: string;
  label?: string;
  current_price?: number;
  momentum?: number;
  sentiment?: string;
  sma_50?: number;
  sma_200?: number;
  macd?: number;
  rsi?: number;
  volatility?: number;
  source?: string;
  title?: string;
  snippet?: string;
  sector?: string;
  industry?: string;
  [key: string]: unknown;
}

interface GraphEdgeData {
  _type: 'edge';
  source: string;
  target: string;
  label: string;
  pearson?: number;
  abs_avg?: number;
  spearman?: number;
  strength?: string;
  direction?: string;
  pearson_formatted?: string;
  [key: string]: unknown;
}

type GraphElementData = GraphNodeData | GraphEdgeData;

interface AgentVisualEdge {
  source: string;
  target: string;
  color: string;
  width: number;
}

interface GraphAgentResponse {
  response: string;
  thought?: string;
  tickers: string[];
  related: string[];
  edges: AgentVisualEdge[];
}

export default function SmartGraph() {
  const { requireAuth } = useRequireAuth();
  const [elements, setElements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [inputTickers, setInputTickers] = useState('');
  const [filter, setFilter] = useState('All');
  const [hoverData, setHoverData] = useState<GraphElementData | null>(null);
  const [selectedNodeData, setSelectedNodeData] = useState<GraphNodeData | null>(null);
  const [selectedEdgeData, setSelectedEdgeData] = useState<GraphEdgeData | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  // ── Chat state ───────────────────────────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /** ── Apply AI-driven visuals (zoom & highlight) ─────────────────── */
  const applyGraphVisuals = useCallback((data: GraphAgentResponse) => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    // 1. Reset
    cy.elements().removeClass('dimmed agent-highlight agent-highlight-related agent-highlight-edge');
    cy.elements().removeStyle();

    // 2. Identify target elements
    const primaryNodes = cy.nodes().filter(n => data.tickers.includes(n.data('ticker') || ''));
    const relatedNodes = cy.nodes().filter(n => data.related.includes(n.data('ticker') || ''));
    
    // 3. Highlight nodes
    primaryNodes.addClass('agent-highlight');
    relatedNodes.addClass('agent-highlight-related');

    // 4. Highlight specific edges
    data.edges.forEach(e => {
      const edge = cy.edges().filter(ele => 
        (ele.data('source') === e.source && ele.data('target') === e.target) ||
        (ele.data('source') === e.target && ele.data('target') === e.source)
      );
      edge.addClass('agent-highlight-edge');
      edge.style({
        'line-color': e.color,
        'width': e.width,
        'target-arrow-color': e.color,
      });
    });

    // 5. Dim the rest
    const relevantElements = primaryNodes.union(relatedNodes).union(cy.elements('.agent-highlight-edge')).neighborhood().union(primaryNodes).union(relatedNodes);
    cy.elements().difference(relevantElements).addClass('dimmed');

    // 6. Zoom/Animate
    if (primaryNodes.length > 0) {
      cy.animate({
        fit: {
          eles: primaryNodes.union(relatedNodes),
          padding: 150
        },
        duration: 800,
        easing: 'ease-in-out'
      });
    }
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleChatSend = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/graph-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMsg,
          history: chatMessages.slice(-6),
          selected_ticker: selectedNodeData?.ticker || null,
        }),
      });
      const data: GraphAgentResponse = await res.json();
      
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.response || 'No response.' },
      ]);

      // Trigger graph visuals if there's metadata
      if (data.tickers?.length || data.related?.length || data.edges?.length) {
        applyGraphVisuals(data);
      }

    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: '⚠️ Could not reach the AI service. Is the backend running?' },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, selectedNodeData, applyGraphVisuals]);

  // ── Fetch graph ───────────────────────────────────────────────────────────
  const fetchGraphData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/graph')
      .then(res => {
        if (!res.ok) throw new Error('Database service unavailable');
        return res.json();
      })
      .then(data => {
        if (data.elements?.length) {
          setElements(data.elements);
        } else {
          setError('No data found in Graph Database.');
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to connect to Graph Database (Neo4j).');
        setLoading(false);
      });
  }, []);

  useEffect(() => { fetchGraphData(); }, [fetchGraphData]);

  // ── Add tickers ───────────────────────────────────────────────────────────
  const handleBuildGraph = async () => {
    if (!inputTickers.trim()) return;
    const tickersArray = inputTickers.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    setIsBuilding(true);
    setError(null);

    try {
      const res = await fetch('http://localhost:8001/api/build-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: tickersArray }),
      });
      if (res.ok) {
        fetchGraphData();
      } else {
        console.error('Backend failed to build graph', await res.text());
        setError('AI Analysis Service (FastAPI) returned an error.');
      }
    } catch (err) {
      console.error('Failed to call FastAPI backend:', err);
      setError('AI Analysis Service (FastAPI) is offline or unreachable.');
    } finally {
      setIsBuilding(false);
      setInputTickers('');
    }
  };

  // ── Layout ────────────────────────────────────────────────────────────────
  const layout = {
    name: 'cose',
    idealEdgeLength: 140,
    nodeOverlap: 20,
    refresh: 20,
    fit: true,
    padding: 40,
    randomize: false,
    componentSpacing: 120,
    nodeRepulsion: 500000,
    edgeElasticity: 80,
    nestingFactor: 5,
    gravity: 60,
    numIter: 1500,
  };

  // ── Stylesheet ────────────────────────────────────────────────────────────
  const style: cytoscape.StylesheetStyle[] = [
    // Company nodes — blue circles
    {
      selector: 'node[label = "Company"]',
      style: {
        'background-color': '#3b82f6',
        'label': 'data(ticker)',
        'color': '#fff',
        'text-valign': 'center',
        'text-halign': 'center',
        'text-outline-width': 2,
        'text-outline-color': '#1e40af',
        'width': 65,
        'height': 65,
        'font-size': '13px',
        'font-weight': 'bold',
        'border-width': 3,
        'border-color': '#1e3a8a',
        'border-opacity': 0.6,
      },
    },
    // Product nodes — green diamonds
    {
      selector: 'node[label = "Product"]',
      style: {
        'background-color': '#10b981',
        'label': 'data(name)',
        'color': '#fff',
        'text-valign': 'bottom',
        'text-margin-y': 6,
        'width': 32,
        'height': 32,
        'font-size': '9px',
        'shape': 'diamond',
        'border-width': 2,
        'border-color': '#065f46',
      },
    },
    // News nodes — amber squares
    {
      selector: 'node[label = "News"]',
      style: {
        'background-color': '#f59e0b',
        'label': 'data(source)',
        'color': '#fff',
        'text-valign': 'bottom',
        'text-margin-y': 5,
        'width': 18,
        'height': 18,
        'font-size': '8px',
        'shape': 'rectangle',
        'border-width': 1,
        'border-color': '#92400e',
      },
    },
    // Default edge style
    {
      selector: 'edge',
      style: {
        'width': 1.5,
        'line-color': '#cbd5e1',
        'target-arrow-color': '#cbd5e1',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'font-size': '9px',
        'text-rotation': 'autorotate',
        'text-margin-y': -10,
        'color': '#64748b',
        'opacity': 0.7,
      },
    },
    // PRODUCES edge
    {
      selector: 'edge[label = "PRODUCES"]',
      style: {
        'line-color': '#6ee7b7',
        'target-arrow-color': '#6ee7b7',
        'line-style': 'dashed',
        'width': 1.5,
        'opacity': 0.5,
      },
    },
    // MENTIONED_IN edge
    {
      selector: 'edge[label = "MENTIONED_IN"]',
      style: {
        'line-color': '#fcd34d',
        'target-arrow-color': '#fcd34d',
        'line-style': 'dotted',
        'width': 1,
        'opacity': 0.4,
      },
    },
    // SAME_SECTOR edge
    {
      selector: 'edge[label = "SAME_SECTOR"]',
      style: {
        'line-color': '#a78bfa',
        'target-arrow-color': '#a78bfa',
        'line-style': 'dashed',
        'width': 1,
        'opacity': 0.35,
        'target-arrow-shape': 'none',
      },
    },
    // RELATED_TO edge (trend similarity)
    {
      selector: 'edge[label = "RELATED_TO"]',
      style: {
        'line-color': '#8b5cf6',
        'target-arrow-color': '#8b5cf6',
        'width': 3,
        'target-arrow-shape': 'none',
        'opacity': 0.6,
      },
    },
    // CORRELATED_WITH — dynamic color set in cy callback
    {
      selector: 'edge[label = "CORRELATED_WITH"]',
      style: {
        'target-arrow-shape': 'none',
        'curve-style': 'bezier',
        'opacity': 0.85,
        'label': 'data(pearson)',
        'font-size': '8px',
        'text-background-color': '#f8fafc',
        'text-background-opacity': 0.8,
        'text-background-padding': '2px',
      } as cytoscape.Css.Edge,
    },
    // Agent Highlights
    {
      selector: '.agent-highlight',
      style: {
        'width': 60,
        'height': 60,
        'border-width': 4,
        'border-color': '#3b82f6',
        'z-index': 999
      } as cytoscape.Css.Node,
    },
    {
      selector: '.agent-highlight-related',
      style: {
        'width': 50,
        'height': 50,
        'border-width': 3,
        'border-color': '#60a5fa',
        'border-style': 'dashed',
        'z-index': 998
      } as cytoscape.Css.Node,
    },
    // Dimmed state
    {
      selector: '.dimmed',
      style: { 'opacity': 0.08 },
    },
    // Transitions
    {
      selector: 'node',
      style: {
        'transition-property': 'opacity, width, height, border-color, border-width',
        'transition-duration': 300,
        'transition-timing-function': 'ease-in-out',
      } as cytoscape.Css.Node, 
    },
    {
      selector: 'edge',
      style: {
        'transition-property': 'opacity, width, line-color',
        'transition-duration': 300,
        'transition-timing-function': 'ease-in-out',
      } as cytoscape.Css.Edge,
    },
  ];

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[600px] gap-3">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Loading Knowledge Graph…</p>
      </div>
    );
  }

  const activeData = selectedEdgeData || selectedNodeData || hoverData;

  const handleSimulate = () => {
    if (!activeData) return;
    requireAuth(() => {
      window.location.href = `/explore/${activeData.ticker}`;
    }, 'Sign in to run Buy/Sell simulations.');
  };

  const handleInsights = () => {
    if (!activeData) return;
    requireAuth(() => {
      alert(`Activating AI Agent for deep insight on ${activeData.ticker}`);
    }, 'Sign in to access advanced AI Insights.');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-[800px] bg-slate-50 dark:bg-slate-900 border rounded-xl overflow-hidden shadow-lg">
      {/* ── Controls (top-left) ──────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 w-80">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg text-sm flex items-start gap-2 shadow-sm animate-in fade-in">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="flex-1">{error}</p>
          </div>
        )}

        {/* Add tickers */}
        <div className="flex gap-2 bg-white/80 dark:bg-black/80 p-3 rounded-lg backdrop-blur-sm shadow border">
          <input
            type="text"
            placeholder="Tickers e.g. AAPL, MSFT"
            value={inputTickers}
            onChange={e => setInputTickers(e.target.value)}
            className="flex-1 px-3 py-1 text-sm border rounded hover:border-blue-500 focus:outline-none dark:bg-transparent"
            onKeyDown={e => { if (e.key === 'Enter') handleBuildGraph(); }}
          />
          <button
            onClick={handleBuildGraph}
            disabled={isBuilding}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isBuilding ? 'Building…' : 'Add'}
          </button>
        </div>

        {/* Filter */}
        <div className="flex bg-white/80 dark:bg-black/80 p-2 rounded-lg backdrop-blur-sm shadow border">
          <select
            className="w-full p-1 text-sm border rounded bg-transparent focus:outline-none"
            value={filter}
            onChange={e => {
              setFilter(e.target.value);
              setSelectedNodeData(null);
              setSelectedEdgeData(null);
              if (cyRef.current) {
                const cy = cyRef.current;
                cy.elements().removeClass('dimmed').style('display', 'element');
                if (e.target.value === 'PositiveNews') {
                  cy.nodes('[label="News"][sentiment!="Positive"]').style('display', 'none');
                } else if (e.target.value === 'BullishCompanies') {
                  cy.nodes('[label="Company"]').filter(ele => (ele.data('sma_50') as number) <= (ele.data('sma_200') as number)).style('display', 'none');
                } else if (e.target.value === 'CorrelationsOnly') {
                  // Hide all non-company nodes and non-correlation edges
                  cy.nodes('[label != "Company"]').addClass('dimmed');
                  cy.edges('[label != "CORRELATED_WITH"]').addClass('dimmed');
                }
              }
            }}
          >
            <option value="All">All Connections</option>
            <option value="CorrelationsOnly">Correlations Only</option>
            <option value="PositiveNews">Positive News Only</option>
            <option value="BullishCompanies">Bullish Companies (SMA 50 &gt; 200)</option>
          </select>
        </div>
      </div>

      {/* ── Legend (bottom-left) ─────────────────────────────────────────── */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm rounded-lg p-3 shadow border text-[11px] space-y-1.5">
        <p className="font-semibold text-xs mb-1.5 text-slate-700 dark:text-slate-300">Legend</p>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Company</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rotate-45 bg-emerald-500 inline-block" /> Industry / Product</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-amber-500 inline-block" /> News Article</div>
        <hr className="border-slate-200 dark:border-slate-700 my-1" />
        <div className="flex items-center gap-2"><span className="w-6 h-0.5 bg-green-600 inline-block rounded" /> Positive Correlation</div>
        <div className="flex items-center gap-2"><span className="w-6 h-0.5 bg-red-600 inline-block rounded" /> Negative Correlation</div>
        <div className="flex items-center gap-2"><span className="w-6 h-0.5 bg-violet-500 inline-block rounded" /> Same Sector / Trend</div>
        <p className="text-slate-400 mt-1 italic">Edge thickness = correlation strength</p>
      </div>

      {/* ── Detail Panel (top-right) ─────────────────────────────────────── */}
      {activeData && (
        <Card className="absolute top-4 right-4 z-10 w-80 p-4 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-2xl border-blue-500/20 transition-all duration-300">
          {/* ── Edge detail (CORRELATED_WITH) ─── */}
          {activeData._type === 'edge' && (
            <div>
              <h3 className="text-sm font-bold mb-3 text-slate-700 dark:text-slate-200">
                Correlation Details
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                  <span className="text-slate-500 block text-xs">Pearson</span>
                  <span className={`font-bold ${(activeData.pearson ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {activeData.pearson ?? 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                  <span className="text-slate-500 block text-xs">Spearman</span>
                  <span className={`font-bold ${(activeData.spearman ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {activeData.spearman ?? 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                  <span className="text-slate-500 block text-xs">Strength</span>
                  <span className="font-semibold">{activeData.strength ?? 'N/A'}</span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                  <span className="text-slate-500 block text-xs">Direction</span>
                  <span className={`font-semibold capitalize ${(activeData.direction ?? '').toLowerCase() === 'positive' ? 'text-green-600' : 'text-red-600'}`}>
                    {activeData.direction ?? 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Company detail ─── */}
          {activeData._type === 'node' && activeData.label === 'Company' && (
            <div>
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold mb-1">{activeData.name} ({activeData.ticker})</h3>
                {selectedNodeData && (
                  <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-1">Locked</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">
                  <span className="text-slate-500 block text-xs">Price</span>
                  <span className="font-semibold">${activeData.current_price?.toFixed(2) ?? '0.00'}</span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">
                  <span className="text-slate-500 block text-xs">Momentum</span>
                  <span className={`font-semibold ${(activeData.momentum ?? 0) > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {(activeData.momentum ?? 0) > 0 ? '+' : ''}{activeData.momentum ?? 0}%
                  </span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">
                  <span className="text-slate-500 block text-xs">SMA 50 / 200</span>
                  <span className="font-semibold text-xs">{activeData.sma_50 ?? 0} / {activeData.sma_200 ?? 0}</span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">
                  <span className="text-slate-500 block text-xs">MACD</span>
                  <span className="font-semibold text-xs">{activeData.macd ?? 0}</span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">
                  <span className="text-slate-500 block text-xs">RSI</span>
                  <span className={`font-semibold text-xs ${(activeData.rsi ?? 50) > 70 ? 'text-red-500' : (activeData.rsi ?? 50) < 30 ? 'text-green-500' : ''}`}>
                    {activeData.rsi ?? 0}
                  </span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">
                  <span className="text-slate-500 block text-xs">Volatility</span>
                  <span className="font-semibold text-xs">{activeData.volatility ?? 0}</span>
                </div>
              </div>

              {selectedNodeData && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={handleSimulate}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 rounded transition-colors"
                  >
                    <LineChart className="w-3.5 h-3.5" />
                    Simulate
                  </button>
                  <button
                    onClick={handleInsights}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium py-2 rounded transition-colors"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    AI Insights
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── News detail ─── */}
          {activeData._type === 'node' && activeData.label === 'News' && (
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-md font-bold">{activeData.source}</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${activeData.sentiment === 'Positive' ? 'bg-green-100 text-green-700' : activeData.sentiment === 'Negative' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                  {activeData.sentiment}
                </span>
              </div>
              <p className="text-sm font-medium mb-2">{activeData.title}</p>
              <p className="text-xs text-slate-500 line-clamp-4">{activeData.snippet}</p>
            </div>
          )}

          {/* ── Product detail ─── */}
          {activeData._type === 'node' && activeData.label === 'Product' && (
            <div>
              <h3 className="text-lg font-bold">{activeData.name}</h3>
              <p className="text-sm text-slate-500">{activeData.sector} • {activeData.industry}</p>
            </div>
          )}
        </Card>
      )}

      {/* ── Cytoscape ────────────────────────────────────────────────────── */}
      <CytoscapeComponent
        elements={elements}
        style={{ width: '100%', height: '100%' }}
        layout={layout}
        stylesheet={style}
        cy={cy => {
          cyRef.current = cy;

          // ── Dynamic edge coloring for correlations ─────────────────────
          cy.edges('[label = "CORRELATED_WITH"]').forEach(edge => {
            const pearson = parseFloat(edge.data('pearson')) || 0;
            const absAvg = parseFloat(edge.data('abs_avg')) || Math.abs(pearson);
            const color = correlationColor(pearson);
            const width = correlationWidth(absAvg);
            edge.style({
              'line-color': color,
              'width': width,
              'target-arrow-color': color,
            });
          });

          // ── Node hover ────────────────────────────────────────────────
          cy.on('mouseover', 'node', event => {
            setHoverData(event.target.data());
            setSelectedEdgeData(null);
          });
          cy.on('mouseout', 'node', () => {
            setHoverData(null);
          });

          // ── Edge click — show correlation details ─────────────────────
          cy.on('tap', 'edge', event => {
            const edge = event.target;
            const edgeLabel = edge.data('label');
            if (edgeLabel === 'CORRELATED_WITH') {
              setSelectedEdgeData({ ...edge.data(), _type: 'edge' });
              setSelectedNodeData(null);
            }
          });

          // ── Node click ────────────────────────────────────────────────
          cy.on('tap', 'node', event => {
            const node = event.target;
            setSelectedNodeData(node.data() as GraphNodeData);
            setSelectedEdgeData(null);

            // Expand node relations visually
            cy.elements().removeClass('dimmed').style('display', 'element');
            const neighbors = node.neighborhood();
            const family = node.union(neighbors);
            cy.elements().difference(family).addClass('dimmed');

            if (filter === 'PositiveNews') {
              family.filter('node[label="News"][sentiment!="Positive"]').addClass('dimmed');
            }
          });

          // ── Background click — reset ──────────────────────────────────
          cy.on('tap', event => {
            if (event.target === cy) {
              setSelectedNodeData(null);
              setSelectedEdgeData(null);
              cy.elements().removeClass('dimmed').style('display', 'element');
              if (filter === 'PositiveNews') {
                cy.nodes('[label="News"][sentiment!="Positive"]').style('display', 'none');
              } else if (filter === 'BullishCompanies') {
                cy.nodes('[label="Company"]').filter(ele => (ele.data('sma_50') as number) <= (ele.data('sma_200') as number)).style('display', 'none');
              } else if (filter === 'CorrelationsOnly') {
                cy.nodes('[label != "Company"]').addClass('dimmed');
                cy.edges('[label != "CORRELATED_WITH"]').addClass('dimmed');
              }
            }
          });
        }}
      />

      {/* ── Chat Toggle Button ─────────────────────────────────────── */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="absolute bottom-4 right-4 z-20 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white p-3 rounded-full shadow-xl transition-all hover:scale-105"
          title="Ask AI about the graph"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      )}

      {/* ── Chat Panel (right side) ───────────────────────────────── */}
      {chatOpen && (
        <div className="absolute top-0 right-0 z-30 h-full w-96 flex flex-col bg-white/98 dark:bg-slate-950/98 backdrop-blur-lg border-l border-slate-200 dark:border-slate-800 shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-white" />
              <span className="text-white font-semibold text-sm">Graph AI Analyst</span>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4 text-white/80" />
            </button>
          </div>

          {/* Context indicator */}
          {selectedNodeData?.ticker && (
            <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900 shrink-0">
              <p className="text-xs text-indigo-600 dark:text-indigo-400">
                📌 Context: <span className="font-semibold">{selectedNodeData.name} ({selectedNodeData.ticker})</span>
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center py-10 space-y-3">
                <Sparkles className="w-8 h-8 text-indigo-400 mx-auto" />
                <p className="text-sm text-slate-500">Ask me anything about the graph</p>
                <div className="space-y-1.5">
                  {[
                    'Tell me about Apple\'s correlations',
                    'Which stocks are most volatile?',
                    'What news is there about Nvidia?',
                    'Compare Tesla and Amazon',
                  ].map((q, i) => (
                    <button
                      key={i}
                      onClick={() => { setChatInput(q); }}
                      className="block w-full text-left text-xs bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 transition-colors"
                    >
                      “{q}”
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-xl rounded-bl-sm">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask about the graph..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleChatSend(); }}
                disabled={chatLoading}
                className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
              <button
                onClick={handleChatSend}
                disabled={chatLoading || !chatInput.trim()}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
