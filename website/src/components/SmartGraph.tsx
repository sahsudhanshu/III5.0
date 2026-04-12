'use client';

import { useEffect, useState, useRef } from 'react';
import cytoscape from 'cytoscape';
import CytoscapeComponent from 'react-cytoscapejs';
import { Card } from '@/components/ui/card'; // fallback if exists, or standard div

type GraphNodeData = {
  label?: string;
  ticker?: string;
  name?: string;
  source?: string;
  snippet?: string;
  sentiment?: string;
  current_price?: number;
  momentum?: number;
  sma_50?: number;
  sma_200?: number;
  macd?: number;
  rsi?: number;
  sector?: string;
  industry?: string;
};

export default function SmartGraph() {
  const [elements, setElements] = useState<cytoscape.ElementDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBuilding, setIsBuilding] = useState(false);
  const [inputTickers, setInputTickers] = useState('');
  const [filter, setFilter] = useState('All');
  const [hoverData, setHoverData] = useState<GraphNodeData | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const fetchGraphData = () => {
    setLoading(true);
    fetch('/api/graph')
      .then(res => res.json())
      .then(data => {
        if (data.elements) {
          setElements(data.elements);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchGraphData();
  }, []);

  const handleBuildGraph = async () => {
    if (!inputTickers.trim()) return;
    const tickersArray = inputTickers.split(',').map(t => t.trim());
    setIsBuilding(true);
    
    try {
      const res = await fetch('http://localhost:8001/api/build-graph', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tickers: tickersArray })
      });
      if (res.ok) {
        // Refresh the cytoscape graph from neo4j
        fetchGraphData();
      } else {
        console.error("Backend failed to build graph", await res.text());
      }
    } catch (error) {
      console.error("Failed to call FastAPI backend:", error);
    } finally {
      setIsBuilding(false);
      setInputTickers('');
    }
  };

  const layout = {
    name: 'cose',
    idealEdgeLength: 100,
    nodeOverlap: 20,
    refresh: 20,
    fit: true,
    padding: 30,
    randomize: false,
    componentSpacing: 100,
    nodeRepulsion: 400000,
    edgeElasticity: 100,
    nestingFactor: 5,
    gravity: 80,
    numIter: 1000,
  };

  const style: cytoscape.Stylesheet[] = [
    {
      selector: 'node[label = "Company"]',
      style: {
        'background-color': '#3b82f6',
        'label': 'data(ticker)',
        'color': '#fff',
        'text-valign': 'center',
        'text-outline-width': 2,
        'text-outline-color': '#3b82f6',
        'width': 60,
        'height': 60,
        'font-size': '14px',
        'font-weight': 'bold',
      }
    },
    {
      selector: 'node[label = "Product"]',
      style: {
        'background-color': '#10b981',
        'label': 'data(name)',
        'color': '#fff',
        'text-valign': 'bottom',
        'text-margin-y': 5,
        'width': 30,
        'height': 30,
        'font-size': '10px',
        'shape': 'diamond'
      }
    },
    {
      selector: 'node[label = "News"]',
      style: {
        'background-color': '#f59e0b',
        'label': 'data(source)',
        'color': '#fff',
        'text-valign': 'bottom',
        'text-margin-y': 5,
        'width': 20,
        'height': 20,
        'font-size': '9px',
        'shape': 'square'
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': '#94a3b8',
        'target-arrow-color': '#94a3b8',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'font-size': '10px',
        'text-rotation': 'autorotate',
        'text-margin-y': -10,
        'color': '#64748b'
      }
    },
    {
      selector: 'edge[label = "RELATED_TO"]',
      style: {
        'line-color': '#8b5cf6',
        'target-arrow-color': '#8b5cf6',
        'width': 'data(strength)', // Make this edge thicker based on strength
        'label': 'Related (Trend)'
      }
    },
    {
      selector: 'edge[label = "CORRELATED_WITH"]',
      style: {
        'line-color': '#ec4899',
        'target-arrow-color': '#ec4899',
        'label': 'data(pearson)',
      }
    },
    {
      selector: '.dimmed',
      style: {
        'opacity': 0.1
      }
    }
  ];

  if (loading) {
    return <div className="flex justify-center items-center h-[600px]">Loading graph...</div>;
  }

  return (
    <div className="relative w-full h-[800px] bg-slate-50 dark:bg-slate-900 border rounded-xl overflow-hidden shadow-lg">
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 w-80">
        
        {/* Input Field Section */}
        <div className="flex gap-2 bg-white/80 dark:bg-black/80 p-3 rounded-lg backdrop-blur-sm shadow border">
          <input 
            type="text" 
            placeholder="Tickers e.g. AAPL, MSFT"
            value={inputTickers}
            onChange={e => setInputTickers(e.target.value)}
            className="flex-1 px-3 py-1 text-sm border rounded hover:border-blue-500 focus:outline-none dark:bg-transparent"
             onKeyDown={(e) => { if (e.key === 'Enter') handleBuildGraph() }}
          />
          <button 
            onClick={handleBuildGraph}
            disabled={isBuilding}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isBuilding ? 'Building...' : 'Add'}
          </button>
        </div>

        {/* Filter Section */}
        <div className="flex bg-white/80 dark:bg-black/80 p-2 rounded-lg backdrop-blur-sm shadow border">
          <select 
            className="w-full p-1 text-sm border rounded bg-transparent focus:outline-none"
            value={filter} 
            onChange={(e) => {
              setFilter(e.target.value);
              if (cyRef.current) {
                const cy = cyRef.current;
                cy.elements().removeClass('dimmed').show();
                if (e.target.value === 'PositiveNews') {
                  cy.nodes('[label="News"][sentiment!="Positive"]').hide();
                } else if (e.target.value === 'BullishCompanies') {
                  cy.nodes('[label="Company"]').filter((ele) => {
                     return ele.data('sma_50') <= ele.data('sma_200');
                  }).hide();
                }
              }
            }}
          >
            <option value="All">All Connections</option>
            <option value="PositiveNews">Positive News Only</option>
            <option value="BullishCompanies">Bullish Companies (SMA 50 &gt; 200)</option>
          </select>
        </div>
      </div>

      {hoverData && (
        <Card className="absolute top-4 right-4 z-10 w-80 p-4 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-2xl border-blue-500/20">
          {hoverData.label === 'Company' && (
            <div>
              <h3 className="text-xl font-bold mb-1">{hoverData.name} ({hoverData.ticker})</h3>
              <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                  <span className="text-slate-500 block text-xs">Price</span>
                  <span className="font-semibold">${hoverData.current_price?.toFixed(2)}</span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                  <span className="text-slate-500 block text-xs">Momentum</span>
                  <span className={`font-semibold ${hoverData.momentum > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {hoverData.momentum > 0 ? '+' : ''}{hoverData.momentum}%
                  </span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                  <span className="text-slate-500 block text-xs">SMA 50 / 200</span>
                  <span className="font-semibold text-xs">{hoverData.sma_50} / {hoverData.sma_200}</span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                  <span className="text-slate-500 block text-xs">MACD</span>
                  <span className="font-semibold text-xs">{hoverData.macd}</span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                  <span className="text-slate-500 block text-xs">RSI</span>
                  <span className={`font-semibold text-xs ${(hoverData.rsi > 70) ? 'text-red-500' : (hoverData.rsi < 30) ? 'text-green-500' : ''}`}>{hoverData.rsi}</span>
                </div>
              </div>
            </div>
          )}
          {hoverData.label === 'News' && (
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-md font-bold">{hoverData.source}</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${hoverData.sentiment === 'Positive' ? 'bg-green-100 text-green-700' : hoverData.sentiment === 'Negative' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                  {hoverData.sentiment}
                </span>
              </div>
              <p className="text-sm font-medium mb-2">{hoverData.title}</p>
              <p className="text-xs text-slate-500 line-clamp-4">{hoverData.snippet}</p>
            </div>
          )}
          {hoverData.label === 'Product' && (
            <div>
              <h3 className="text-lg font-bold">{hoverData.name}</h3>
              <p className="text-sm text-slate-500">{hoverData.sector} • {hoverData.industry}</p>
            </div>
          )}
        </Card>
      )}

      <CytoscapeComponent
        elements={elements}
        style={{ width: '100%', height: '100%' }}
        layout={layout}
        stylesheet={style}
        cy={(cy) => {
          cyRef.current = cy;
          
          cy.on('mouseover', 'node', (event) => {
            setHoverData(event.target.data());
          });
          cy.on('mouseout', 'node', () => {
            setHoverData(null);
          });
          
          cy.on('tap', 'node', (event) => {
            const node = event.target;
            
            // Expand node relations visually
            cy.elements().removeClass('dimmed').show();
            // Get neighbors and edges connected to the node
            const neighbors = node.neighborhood();
            // Elements to keep visible (the node, its neighbors, and connecting edges)
            const family = node.union(neighbors);
            
            // Fade out everything else
            cy.elements().difference(family).addClass('dimmed').hide();
            
            // Re-apply filters on the subset if needed
            if (filter === 'PositiveNews') {
              family.filter('node[label="News"][sentiment!="Positive"]').hide();
            }
          });
          
          // Click background to reset
          cy.on('tap', (event) => {
            if (event.target === cy) {
               cy.elements().removeClass('dimmed').show();
               // Reapply global filters
               if (filter === 'PositiveNews') {
                 cy.nodes('[label="News"][sentiment!="Positive"]').hide();
               } else if (filter === 'BullishCompanies') {
                 cy.nodes('[label="Company"]').filter((ele) => ele.data('sma_50') <= ele.data('sma_200')).hide();
               }
            }
          });
        }}
      />
    </div>
  );
}
