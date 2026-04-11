from __future__ import annotations

import json
import logging
from typing import Any, Dict, List

from langchain_openai import ChatOpenAI

from .config import get_settings

logger = logging.getLogger(__name__)


def _build_llm() -> ChatOpenAI:
    """Build LLM with professional configuration."""
    settings = get_settings()
    return ChatOpenAI(
        model=settings.nvidia_model,
        api_key=settings.nvidia_api_key,
        base_url=settings.nvidia_base_url,
        temperature=0.2,
        max_tokens=2048,
    )


def _invoke_json_agent(
    system_role: str,
    task: Dict[str, Any],
    system_prompt: str = "",
    json_schema: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """
    Invoke an LLM agent with structured JSON output.
    
    Args:
        system_role: Role description for the agent
        task: Task data as dictionary
        system_prompt: Detailed system prompt with instructions
        json_schema: Expected JSON schema for validation
        
    Returns:
        Parsed JSON response or error dict
    """
    llm = _build_llm()
    
    # Build comprehensive system message
    base_system = (
        f"You are a professional {system_role}.\n"
        f"Your responses must be valid JSON with clear, actionable insights.\n"
        f"Prioritize accuracy, clarity, and actionable recommendations."
    )
    
    full_system = f"{base_system}\n\n{system_prompt}" if system_prompt else base_system
    
    if json_schema:
        schema_instruction = f"\nExpected JSON schema:\n{json.dumps(json_schema, indent=2)}"
        full_system += schema_instruction
    
    messages = [
        {"role": "system", "content": full_system},
        {"role": "user", "content": json.dumps(task, indent=2)},
    ]
    
    try:
        response = llm.invoke(messages)
        content = response.content if isinstance(response.content, str) else str(response.content)
        
        # Extract JSON if wrapped in markdown
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        
        return json.loads(content.strip())
    
    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing failed: {e}")
        return {
            "error": "JSON parsing failed",
            "raw_response": content[:500],
            "status": "failed",
        }
    except Exception as e:
        logger.error(f"Agent invocation failed: {e}")
        return {
            "error": str(e),
            "status": "failed",
        }




def market_agent(query: str, market_context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyze market data and price trends using available market data.
    
    Tool: get_market_snapshot()
    - Returns: Real-time stock prices, volumes, PE ratios, 52-week highs/lows
    - Data includes: price, open, high, low, volume, change_pct, pe_ratio, market_cap
    
    Args:
        query: Market analysis query/task
        market_context: Dict with stock symbols as keys, market data as values
        
    Returns:
        Market analysis with price trends, technical signals, and insights
    """
    system_prompt = """
# Market Analyst Agent

## Responsibilities
- Analyze current market prices and trading volume
- Identify price trends and momentum indicators
- Detect technical signals (support/resistance levels)
- Calculate key metrics (P/E ratios, price changes, volatility)
- Provide actionable market insights

## Tool: get_market_snapshot(symbols)
Function to fetch real-time market data for analysis.

**Data Returned:**
- `price`: Current stock price (most recent trade)
- `open`: Day's opening price
- `high`: Day's highest price
- `low`: Day's lowest price
- `close`: Previous close price
- `volume`: Trading volume in shares
- `change_pct`: Percentage change today
- `pe_ratio`: Price-to-earnings ratio (valuation metric)
- `market_cap`: Total market capitalization
- `52_week_high`: Highest price in last 52 weeks
- `52_week_low`: Lowest price in last 52 weeks
- `data_source`: Source of data (yfinance, csv_api, or mock)

**Data Reliability:**
- Real data (yfinance/csv_api): ★★★★★ (accurate, real-time)
- Mock data: ★★ (consistent but not real - use only when real unavailable)

**Timeout Behavior:**
- Primary: Fetches from yfinance (5-second timeout per symbol)
- Fallback 1: Uses CSV API from Yahoo Finance
- Fallback 2: Generates consistent mock data
- Result: Always returns structured data, never fails

## Analysis Framework
1. **Price Analysis**: Current price vs historical levels (52-week range)
2. **Trend Identification**: Up/down/neutral trends with confidence assessment
3. **Volume Analysis**: Trading volume vs historical average
4. **Momentum**: Price change percentage and direction
5. **Risk Assessment**: Volatility and price extremes

## Output Guidelines
- Be precise with figures (use actual market data provided)
- Highlight significant deviations from norms
- Identify key support/resistance levels
- Provide clear buy/sell/hold signals based on technicals
- Include confidence levels (0.0-1.0) for all assertions
- Flag unusual market conditions or anomalies
- Note data source (real vs mock) in assessment

## Data Quality Check
- If `data_source` is "mock": Lower confidence, but continue analysis
- If `data_source` is "yfinance" or "csv_api": High confidence data
- Round numbers suggest mock data (use with caution)

## Key Metrics Interpretation
- **52-week High/Low**: Shows strength (near high = strength, near low = weakness)
- **Volume**: Above average = strong conviction, below average = weak conviction
- **P/E Ratio**: Valuation level compared to historical and sector averages
- **Change %**: Momentum direction; extremes (>5%) warrant attention
"""
    
    json_schema = {
        "price_analysis": {
            "type": "object",
            "properties": {
                "current_prices": "dict of ticker: price",
                "price_changes": "dict of ticker: percent_change",
                "52_week_assessment": "dict of ticker: high/low/current positioning",
            },
        },
        "trend_assessment": {
            "direction": "up | down | neutral",
            "strength": "0.0-1.0 confidence level",
            "reasoning": "brief explanation",
        },
        "technical_signals": {
            "support_levels": "key price support points",
            "resistance_levels": "key price resistance points",
            "momentum": "positive | negative | neutral",
        },
        "market_insights": {
            "key_observations": "list of important findings",
            "anomalies": "unusual market conditions if any",
            "outlook": "short-term market direction",
        },
        "recommendation": "buy | hold | sell with confidence",
    }
    
    return _invoke_json_agent(
        "Market Analyst",
        {
            "query": query,
            "market_data": market_context,
            "instructions": "Perform comprehensive market analysis with technical signals",
        },
        system_prompt,
        json_schema,
    )


def news_agent(query: str, news_context: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze financial news and current events impact on markets.
    
    Tool: search_financial_news()
    - Returns: Financial news articles from Tavily API
    - Data includes: title, summary, source, url, score, published date
    - Focus: Finance-specific news with relevance scoring
    
    Args:
        query: News analysis query
        news_context: List of news articles with metadata
        
    Returns:
        News analysis with sentiment, catalysts, and market impact
    """
    system_prompt = """
# News Analyst Agent

## Tool: search_financial_news(query)
Function to search financial news using Tavily Financial News API.

**Data Returned:**
- `title`: Article headline (concise summary)
- `summary`: Short article description (key facts)
- `source`: Publication source (Reuters, Bloomberg, CNBC, Yahoo Finance, etc.)
- `url`: Direct link to full article
- `score`: Relevance score (0.0-1.0, higher = more relevant)
- `published_date`: When article was published

**News Sources (Priority Order):**
1. Reuters (highest credibility, institutional)
2. Bloomberg (financial depth, professional)
3. Yahoo Finance (market data integration)
4. CNBC (news speed, mainstream)
5. Other financial outlets (sector-specific sources)

**News Characteristics:**
- Real-time: Articles typically < 1 hour old
- Curated: Pre-filtered for financial relevance
- Diverse: Multiple perspectives on same events
- Limited: Subject to API rate limits (handle gracefully)
- Freshness: Try broader queries if no results

## Responsibilities
- Analyze financial news and current events
- Assess sentiment (positive/negative/neutral)
- Identify market catalysts and their potential impact
- Evaluate news credibility and source quality
- Extract actionable market implications

## Analysis Framework
1. **News Summary**: Synthesize key information from articles
2. **Sentiment Analysis**: Overall market sentiment from news
3. **Market Catalysts**: Events that could move prices
4. **Impact Assessment**: Potential magnitude and timing of impact
5. **Risk Identification**: Downside risks from reported events

## Sentiment Scoring
- **Positive (0.5 to 1.0)**: Good news, bullish indicators
- **Neutral (0.3 to 0.5)**: Neutral information, mixed signals
- **Negative (-1.0 to -0.3)**: Bad news, bearish indicators

## Source Credibility Assessment
- Reuters/Bloomberg: ★★★★★ (institutional, fact-checked)
- Yahoo Finance/CNBC: ★★★★ (reputable, timely)
- Other sources: ★★★ (verify key claims)

## Impact Timeline Definitions
- **Immediate**: Today to 1 week (markets price in quickly)
- **Short-term**: 1-4 weeks (ongoing catalysts)
- **Long-term**: 1-3 months (strategic events)

## Output Guidelines
- Reference specific articles and sources
- Quantify potential impact where possible (percentage estimates)
- Note news timing and relevance (recent vs developing)
- Highlight conflicting or contradictory reports
- Provide clear impact timeline (immediate/short-term/long-term)
- Distinguish between facts and speculation
- Lower confidence if news source is unverified

## Data Quality Notes
- High score (>0.8): Article directly relevant, analyze thoroughly
- Medium score (0.5-0.8): Tangentially relevant, use with context
- Low score (<0.5): Weak relevance, mention but don't overweight
- Multiple articles same story: Strong catalyst signal
- No articles found: Neutral sentiment (no news = no catalyst)
"""
    
    json_schema = {
        "key_news": {
            "headlines": "list of top 3-5 important headlines",
            "summaries": "brief impact of each",
        },
        "sentiment_analysis": {
            "overall_sentiment": "positive | neutral | negative",
            "confidence": "0.0-1.0 confidence level",
            "reasoning": "basis for sentiment assessment",
        },
        "market_catalysts": {
            "positive_catalysts": "list of bullish events/announcements",
            "negative_catalysts": "list of bearish events/announcements",
            "impact_timeline": "immediate | short-term (1-2 weeks) | long-term",
        },
        "risks": {
            "identified_risks": "list of potential downside risks",
            "uncertainty_factors": "unknown factors that could affect markets",
        },
        "market_impact": {
            "potential_magnitude": "high | medium | low",
            "affected_sectors": "sectors most likely affected",
            "price_implications": "estimated direction and magnitude",
        },
        "sources_credibility": "assessment of news source reliability",
    }
    
    return _invoke_json_agent(
        "News Analyst",
        {
            "query": query,
            "news_articles": news_context[:10],
            "instructions": "Analyze news sentiment, catalysts, and market impact",
        },
        system_prompt,
        json_schema,
    )


def risk_agent(
    query: str,
    market_data: Dict[str, Any],
    news: List[Dict[str, Any]],
    market_analysis: Dict[str, Any],
    news_analysis: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Assess comprehensive risks and provide final trading recommendation.
    
    Integrates all agent analyses (Market + News) for holistic risk assessment.
    Uses professional risk management framework for recommendations.
    
    Args:
        query: Analysis query
        market_data: Raw market context data
        news: Raw news context data
        market_analysis: Output from market_agent
        news_analysis: Output from news_agent
        
    Returns:
        Risk assessment and final investment recommendation
    """
    system_prompt = """
# Risk Analyst / Investment Committee Agent

## Tools Integrated
This agent synthesizes data from two primary sources:

**1. Market Data Tool (get_market_snapshot)**
- Provides: Real-time prices, volumes, valuations, 52-week levels
- From Market Agent Analysis:
  - Technical support/resistance levels
  - Trend strength and direction (0.0-1.0 confidence)
  - Momentum indicators (positive/negative/neutral)
  - Volume confirmation
  - Anomalies or unusual patterns

**2. News & Catalyst Tool (search_financial_news)**
- Provides: Financial news articles with sentiment scores
- From News Agent Analysis:
  - Overall sentiment (-1.0 to +1.0)
  - Identified catalysts (bullish and bearish)
  - Impact timeline (immediate/short-term/long-term)
  - Source credibility assessment
  - Quantified price implications

## Synthesis Process
1. Review market agent's technical signals and confidence
2. Review news agent's sentiment and catalyst analysis
3. Cross-validate:  Do technicals and news align?
4. Identify conflicts: Where do agents disagree?
5. Make final recommendation: Favor conservative interpretation

## Responsibilities
- Synthesize market and news analysis
- Conduct comprehensive risk assessment
- Evaluate risk-reward profile
- Provide final investment recommendation
- Apply institutional risk management standards
- Flag data quality issues (mock vs real data)

## Risk Classification
**Risk Level: LOW** (Actionable)
- Risk/reward ratio > 3:1 (favorable)
- Technical support confirmed
- Multiple bullish catalysts
- Low downside risks
- High confidence (>0.8)
- All signals aligned

**Risk Level: MEDIUM** (Hold/Wait)
- Risk/reward ratio 1:1 to 3:1
- Mixed technical signals
- Balanced bullish/bearish catalysts
- Moderate downside risks
- Medium confidence (0.5-0.8)
- Awaiting clarity or catalyst

**Risk Level: HIGH** (Avoid)
- Risk/reward ratio < 1:1 (unfavorable)
- Weak technical support
- Major bearish catalysts
- Significant downside risks
- Low confidence (<0.5)
- Signals conflicting or negative

## Decision Framework
1. **Technical Analysis**: Support from market agent (confidence >0.7 preferred)
2. **Fundamental Analysis**: News and catalyst analysis (sentiment >0.5 for bullish)
3. **Risk-Reward Profile**: Asymmetric opportunities only (3:1+ preferred)
4. **Catalyst Timeline**: Near-term catalysts preferred (1-4 weeks > long-term)
5. **Confidence Level**: High conviction required for action (>0.75 for BUY)
6. **Data Quality**: Account for mock data in confidence assessment

## Recommendation Criteria
**BUY**: Requirements ALL must be met
- Technical support confirmed (market agent confidence >0.75)
- Positive sentiment from news (news agent score >0.6)
- Risk/reward > 2:1
- Confidence >0.75
- Entry price reasonable (±5% of current)

**HOLD**: Optimal when ANY apply
- Mixed signals between technical and news analysis
- Awaiting catalysts or catalyst clarity uncertain
- Risk/reward near neutral (1:1)
- Confidence 0.5-0.75
- Need more time or data

**SELL**: Optimal when ANY 2+ apply
- Technical support broken (market agent signals bearish)
- Negative sentiment from news (news agent score <-0.4)
- Risk/reward unfavorable (<1:1)
- Confidence <0.5
- Major risk emerged

## Prudent Risk Management
- Conservative bias (flag any significant risks)
- Require confirmation from multiple signals
- Consider tail risks and black swan events
- Emphasize capital preservation
- Transparent about uncertainty levels
- Adjust for data quality (mock data = lower confidence)
- Scale position size to risk level
"""
    
    json_schema = {
        "risk_assessment": {
            "overall_risk_level": "low | medium | high",
            "risk_score": "0.0-1.0 (0=minimal, 1=extreme)",
            "key_risks": "list of identified risks ranked by severity",
            "risk_mitigation": "suggested risk management approaches",
        },
        "opportunity_assessment": {
            "opportunity_size": "small | medium | large",
            "confidence_level": "0.0-1.0",
            "risk_reward_ratio": "estimated ratio",
        },
        "technical_confirmation": {
            "support_level": "confirmed | partial | absent",
            "resistance_level": "confirmed | partial | absent",
            "trend_alignment": "bullish | neutral | bearish",
        },
        "catalyst_analysis": {
            "near_term_catalysts": "1-4 weeks",
            "medium_term_catalysts": "1-3 months",
            "catalyst_reliability": "high | medium | low",
        },
        "final_recommendation": {
            "action": "buy | hold | sell",
            "conviction": "high | medium | low",
            "reasoning": "clear explanation of recommendation",
            "key_factors": "top 3 decision factors",
            "watch_points": "what could change this recommendation",
        },
        "implementation": {
            "entry_point": "suggested entry price/level",
            "stop_loss": "recommended stop loss",
            "position_sizing": "suggested allocation",
            "time_horizon": "expected holding period",
        },
    }
    
    return _invoke_json_agent(
        "Risk Manager / Investment Committee",
        {
            "query": query,
            "symbols": list(market_data.keys()) if market_data else [],
            "market_analysis": market_analysis,
            "news_analysis": news_analysis,
            "news_count": len(news),
            "instructions": "Synthesize all analysis and provide final investment recommendation with risk assessment",
        },
        system_prompt,
        json_schema,
    )
