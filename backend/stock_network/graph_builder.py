"""
Graph construction module.
Builds graph structure from correlation data.
"""

import networkx as nx
from typing import Dict, Tuple
import logging

logger = logging.getLogger(__name__)


def build_graph(
    tickers: list,
    lagged_corr: Dict[Tuple[str, str], Dict],
    correlation_matrix: Dict = None
) -> nx.Graph:
    """
    Build NetworkX graph with stocks as nodes and correlations as edges.
    
    Args:
        tickers: List of stock tickers
        lagged_corr: Output from compute_lagged_correlation()
        correlation_matrix: Optional pandas DataFrame with correlations
    
    Returns:
        NetworkX Graph object
    """
    G = nx.Graph()
    
    # Add nodes (stocks)
    for ticker in tickers:
        G.add_node(ticker)
    
    # Add edges (correlations)
    for (ticker_a, ticker_b), corr_data in lagged_corr.items():
        correlation = corr_data['correlation']
        lag = corr_data['lag']
        weight = corr_data['abs_correlation']
        
        # Determine edge color based on correlation sign
        color = 'green' if correlation > 0 else 'red'
        
        # Determine direction
        direction = corr_data.get('direction', f"{ticker_a}←→{ticker_b}")
        
        G.add_edge(
            ticker_a,
            ticker_b,
            weight=weight,
            correlation=correlation,
            lag=lag,
            direction=direction,
            color=color,
        )
    
    logger.info(f"Built graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    return G


def get_graph_metrics(G: nx.Graph) -> Dict:
    """
    Compute graph metrics.
    
    Args:
        G: NetworkX Graph
    
    Returns:
        Dict with various network metrics
    """
    metrics = {
        'num_nodes': G.number_of_nodes(),
        'num_edges': G.number_of_edges(),
        'density': nx.density(G),
        'num_connected_components': nx.number_connected_components(G),
    }
    
    # Compute centrality measures
    try:
        degree_centrality = nx.degree_centrality(G)
        metrics['degree_centrality'] = degree_centrality
    except:
        pass
    
    try:
        betweenness = nx.betweenness_centrality(G)
        metrics['betweenness_centrality'] = betweenness
    except:
        pass
    
    logger.info(f"Graph metrics: {metrics['num_nodes']} nodes, {metrics['num_edges']} edges")
    return metrics


def identify_clusters(G: nx.Graph) -> Dict[str, list]:
    """
    Identify clusters/communities in the graph.
    Uses greedy modularity optimization.
    
    Args:
        G: NetworkX Graph
    
    Returns:
        Dict mapping cluster ID to list of tickers
    """
    try:
        from networkx.algorithms import community
        communities = community.greedy_modularity_communities(G)
        
        clusters = {}
        for idx, comm in enumerate(communities):
            clusters[f'Cluster_{idx}'] = list(comm)
        
        logger.info(f"Identified {len(clusters)} clusters")
        return clusters
    except Exception as e:
        logger.warning(f"Could not identify clusters: {e}")
        return {}


def get_node_properties(G: nx.Graph) -> Dict[str, Dict]:
    """
    Get properties for each node (stock).
    
    Args:
        G: NetworkX Graph
    
    Returns:
        Dict mapping ticker to properties
    """
    properties = {}
    
    for node in G.nodes():
        neighbors = list(G.neighbors(node))
        edges = G.edges(node, data=True)
        
        avg_correlation = np.mean([
            edge[2]['correlation'] for edge in edges
        ]) if edges else 0
        
        properties[node] = {
            'degree': G.degree(node),
            'num_neighbors': len(neighbors),
            'neighbors': neighbors,
            'avg_correlation': avg_correlation,
        }
    
    return properties


import numpy as np
