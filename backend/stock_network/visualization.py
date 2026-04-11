"""
Visualization module.
Creates interactive Plotly visualizations of the stock network.
"""

import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import networkx as nx
import numpy as np
from typing import Dict, Tuple
import logging

logger = logging.getLogger(__name__)


def plot_correlation_heatmap(correlation_matrix: pd.DataFrame) -> go.Figure:
    """
    Create heatmap of correlation matrix.
    
    Args:
        correlation_matrix: Output from compute_correlation_matrix()
    
    Returns:
        Plotly Figure object
    """
    fig = go.Figure(data=go.Heatmap(
        z=correlation_matrix.values,
        x=correlation_matrix.columns,
        y=correlation_matrix.index,
        colorscale='RdBu',
        zmid=0,
        text=correlation_matrix.values,
        texttemplate='.2f',
        textfont={"size": 10},
    ))
    
    fig.update_layout(
        title="Correlation Matrix Between Stocks",
        xaxis_title="Stock",
        yaxis_title="Stock",
        width=900,
        height=800,
        hovermode='closest',
    )
    
    return fig


def plot_network_graph(
    G: nx.Graph,
    lagged_corr: Dict[Tuple[str, str], Dict],
    pos: Dict = None,
    title: str = "Stock Network Graph"
) -> go.Figure:
    """
    Create interactive network visualization using Plotly.
    
    Args:
        G: NetworkX graph
        lagged_corr: Correlation data with lag information
        pos: Node positions (computed if None)
        title: Figure title
    
    Returns:
        Plotly Figure object
    """
    # Compute layout if not provided
    if pos is None:
        pos = nx.spring_layout(G, k=2, iterations=50, seed=42)
    
    # Extract edge and node info
    edge_trace_pos = []
    edge_trace_neg = []
    edge_info_pos = []
    edge_info_neg = []
    
    for edge in G.edges(data=True):
        x0, y0 = pos[edge[0]]
        x1, y1 = pos[edge[1]]
        
        correlation = edge[2].get('correlation', 0)
        lag = edge[2].get('lag', 0)
        direction = edge[2].get('direction', '')
        weight = edge[2].get('weight', 0)
        
        hover_text = (
            f"<b>{edge[0]} ↔ {edge[1]}</b><br>"
            f"Correlation: {correlation:.3f}<br>"
            f"Lag: {lag} days<br>"
            f"Direction: {direction}<br>"
            f"Strength: {weight:.3f}"
        )
        
        if correlation >= 0:
            edge_trace_pos.append([(x0, x1), (y0, y1)])
            edge_info_pos.append(hover_text)
        else:
            edge_trace_neg.append([(x0, x1), (y0, y1)])
            edge_info_neg.append(hover_text)
    
    # Create figure
    fig = go.Figure()
    
    # Add positive correlation edges (green)
    for i, edge in enumerate(edge_trace_pos):
        fig.add_trace(go.Scatter(
            x=edge[0], y=edge[1],
            mode='lines',
            line=dict(width=2, color='rgba(0, 200, 0, 0.5)'),
            hoverinfo='text',
            text=edge_info_pos[i],
            showlegend=False,
        ))
    
    # Add negative correlation edges (red)
    for i, edge in enumerate(edge_trace_neg):
        fig.add_trace(go.Scatter(
            x=edge[0], y=edge[1],
            mode='lines',
            line=dict(width=2, color='rgba(200, 0, 0, 0.5)'),
            hoverinfo='text',
            text=edge_info_neg[i],
            showlegend=False,
        ))
    
    # Add nodes
    node_x = [pos[node][0] for node in G.nodes()]
    node_y = [pos[node][1] for node in G.nodes()]
    node_text = list(G.nodes())
    node_degree = [G.degree(node) for node in G.nodes()]
    
    # Node size based on degree
    node_size = [20 + 15 * G.degree(node) for node in G.nodes()]
    
    node_hover_text = [
        f"<b>{node}</b><br>Connections: {G.degree(node)}"
        for node in G.nodes()
    ]
    
    fig.add_trace(go.Scatter(
        x=node_x, y=node_y,
        mode='markers+text',
        text=node_text,
        textposition='top center',
        hoverinfo='text',
        hovertext=node_hover_text,
        marker=dict(
            size=node_size,
            color='lightblue',
            line=dict(width=2, color='darkblue'),
        ),
        showlegend=False,
    ))
    
    fig.update_layout(
        title=title,
        showlegend=False,
        hovermode='closest',
        margin=dict(b=20, l=5, r=5, t=40),
        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        width=1000,
        height=800,
        plot_bgcolor='rgba(240, 240, 240, 0.9)',
    )
    
    return fig


def plot_time_series_comparison(
    returns: pd.DataFrame,
    ticker_a: str,
    ticker_b: str
) -> go.Figure:
    """
    Plot normalized time series comparison of two stocks.
    
    Args:
        returns: DataFrame of returns
        ticker_a: First ticker
        ticker_b: Second ticker
    
    Returns:
        Plotly Figure object
    """
    # Normalize to start at 0
    series_a = (returns[ticker_a] / returns[ticker_a].std()).cumsum()
    series_b = (returns[ticker_b] / returns[ticker_b].std()).cumsum()
    
    fig = go.Figure()
    
    fig.add_trace(go.Scatter(
        x=series_a.index, y=series_a.values,
        name=ticker_a,
        mode='lines',
        line=dict(width=2, color='blue'),
    ))
    
    fig.add_trace(go.Scatter(
        x=series_b.index, y=series_b.values,
        name=ticker_b,
        mode='lines',
        line=dict(width=2, color='red'),
    ))
    
    fig.update_layout(
        title=f"Normalized Returns: {ticker_a} vs {ticker_b}",
        xaxis_title="Date",
        yaxis_title="Normalized Returns",
        hovermode='x unified',
        width=1000,
        height=500,
    )
    
    return fig


def plot_lagged_correlation_heatmap(
    lagged_corr: Dict[Tuple[str, str], Dict]
) -> go.Figure:
    """
    Create heatmap showing lag and correlation for all pairs.
    
    Args:
        lagged_corr: Output from compute_lagged_correlation()
    
    Returns:
        Plotly Figure object
    """
    # Create summary table
    data = []
    for (ticker_a, ticker_b), info in lagged_corr.items():
        data.append({
            'Ticker A': ticker_a,
            'Ticker B': ticker_b,
            'Correlation': info['correlation'],
            'Lag (days)': info['lag'],
            'Direction': info['direction'],
        })
    
    df = pd.DataFrame(data)
    
    # Create table figure
    fig = go.Figure(data=[go.Table(
        header=dict(
            values=list(df.columns),
            fill_color='paleturquoise',
            align='left',
            font=dict(size=12),
        ),
        cells=dict(
            values=[df[col] for col in df.columns],
            fill_color='lavender',
            align='left',
            font=dict(size=11),
        )
    )])
    
    fig.update_layout(
        title="Lagged Correlation Summary",
        height=400 + 30 * len(df),
        width=800,
    )
    
    return fig
