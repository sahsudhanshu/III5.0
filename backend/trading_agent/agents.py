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
    
    Tool: get_market_snapshot(symbols, timeout=5, period='3mo')
    - Returns: Real-time + historical market data with time series
    - Includes: Current prices, volumes, PE ratios, 52-week ranges, volatility
    - Fallback: Consistent mock data when yfinance unavailable
    
    Args:
        query: Market analysis query/task
        market_context: Dict with stock symbols as keys, market data as values
        
    Returns:
        Market analysis with price trends, technical signals, and insights
    """
    system_prompt = """
# Market Analyst Agent

## PRIMARY TOOL: get_market_snapshot(symbols, timeout=5, period='3mo')

### Function Purpose
Fetch comprehensive real-time market data with historical time series for technical analysis.

### Data Returned (per symbol)
```
{
    "AAPL": {
        "current": {
            "price": float,           # Current trading price
            "open": float,            # Today's opening price
            "high": float,            # Today's highest price
            "low": float,             # Today's lowest price
            "volume": float,          # Trading volume in shares
            "change_pct": float,      # Percentage change today
        },
        "history": {
            "dates": [str, ...],      # YYYY-MM-DD format, chronological
            "open": [float, ...],     # Opening prices per day
            "high": [float, ...],     # High prices per day
            "low": [float, ...],      # Low prices per day
            "close": [float, ...],    # Closing prices per day
            "volume": [float, ...],   # Volume per day
        },
        "stats": {
            "pe_ratio": float,            # Price-to-Earnings valuation
            "market_cap": float,          # Total market capitalization
            "52_week_high": float,        # 52-week highest price
            "52_week_low": float,         # 52-week lowest price
            "avg_volume": float,          # Average daily volume
            "volatility": float,          # Price volatility (%)
        },
        "data_source": str,           # "yfinance" | "csv_api" | "mock"
    }
}
```

### Historical Periods Supported
- **'1mo'**: 21 trading days (4-5 weeks)
- **'3mo'**: 63 trading days (12-13 weeks) ← Default
- **'6mo'**: 126 trading days (25-26 weeks)
- **'1y'**: 252 trading days (~1 year)
- **'2y'**: 504 trading days (~2 years)

### Data Sources (Reliability Order)
1. **yfinance** (★★★★★) - Primary, real-time from Yahoo Finance
2. **CSV API** (★★★★) - Alternative datasource for historical data
3. **Mock data** (★★) - Consistent when real sources unavailable

### Fallback Strategy
- **Primary**: yfinance fetch (5-second timeout per symbol)
- **Fallback 1**: CSV API from Yahoo Finance
- **Fallback 2**: Consistent mock data (seed-based per symbol)
- **Result**: Always returns complete data structure

### Data Quality Assessment
- **Real data** (yfinance/csv_api): High confidence, use for decisions
- **Mock data**: Consistent but synthetic - note in analysis
- **Data source field**: Indicates data reliability in context

### Technical Analysis Framework
1. **Price Analysis**
   - Current price vs 52-week range (strength assessment)
   - Distance from highs = weakness signal
   - Distance from lows = bounce opportunity
   - Trend: Near all-time highs = strong uptrend

2. **Trend Identification**
   - Compare close prices across historical period
   - Calculate slope (recent vs distant past)
   - Confirm with volume (high volume = strong trend)
   - Up/Down/Sideways classification

3. **Volume Analysis**
   - Current volume vs average volume
   - High volume = strong conviction
   - Low volume = weak conviction
   - Volume confirms price moves

4. **Momentum Indicators**
   - Percent change today (0-3% normal, >5% extreme)
   - Price acceleration (increasing/decreasing)
   - Relative strength (positive/negative/neutral)

5. **Support & Resistance**
   - Support: Historical low prices (buyers defend)
   - Resistance: Historical high prices (sellers emerge)
   - Key levels: 52-week high/low most important

6. **Volatility Assessment**
   - High volatility (>2%): Risky, wider stop losses
   - Normal volatility (1-2%): Typical trading conditions
   - Low volatility (<1%): Stable, narrow range

## Analysis Output Requirements
- Compare multiple time periods (identify trend changes)
- Reference actual data points from historical arrays
- Identify key support (lowest price) and resistance (highest price)
- Calculate price momentum (compare recent to historical)
- Assess volume conviction (current vs average)
- Flag extremes (near 52-week high/low)
- Provide specific trading levels (entry, stop, target)

## Confidence Scoring Guidelines
- **High (0.8-1.0)**: Clear trend, strong volume, aligned signals
- **Medium (0.5-0.8)**: Mixed signals, moderate volume, conflicting indicators
- **Low (<0.5)**: No clear trend, weak volume, contradictory signals

## Data Quality Adjustments
- **Real data (yfinance)**: Full confidence in numbers
- **Mock data**: Realistic but consistent (lower confidence in specifics)
- Note data_source in all recommendations
- If mock: Add caveat that actual prices may differ significantly

## Key Metrics Interpretation
- **52-week High/Low**: Shows long-term strength/weakness
  - Near high (>90% of range): Very strong
  - Mid-range (50%): Neutral
  - Near low (<10% of range): Very weak
- **P/E Ratio**: Valuation metric
  - High P/E (>25): Expensive, growth priced in
  - Low P/E (<15): Cheap or troubled
- **Volatility**: Risk measure
  - High vol (>3%): Risky positioning
  - Low vol (<1%): Stable, predictable
- **Change %**: Today's momentum
  - Up >3%: Strong buying
  - Down >3%: Strong selling
  - ±1%: Normal trading range
"""
    
    json_schema = {
        "price_analysis": {
            "current_prices": "dict of ticker: current_price ($)",
            "price_ranges": "dict of ticker: {current_pct_of_52w_high, near_high_or_low}",
            "today_moves": "dict of ticker: change_pct and direction",
            "52_week_assessment": "for each ticker: is it strong (near high) or weak (near low)?",
        },
        "trend_assessment": {
            "overall_direction": "bullish | bearish | neutral",
            "trend_strength": "0.0-1.0 confidence level",
            "time_period": "which periods show strongest trend",
            "momentum": "accelerating | decelerating | stable",
            "reasoning": "specific price evidence from data",
        },
        "technical_signals": {
            "support_levels": "key historical lows where buyers likely defend",
            "resistance_levels": "key historical highs where sellers likely emerge",
            "momentum_indicator": "positive | negative | neutral with confidence",
            "volume_confirmation": "is volume supporting the trend?",
        },
        "risk_assessment": {
            "volatility_level": "high | normal | low with % value",
            "drawdown_risk": "estimated downside from current to support",
            "upside_potential": "estimated upside from current to resistance",
            "risk_reward_ratio": "calculated ratio",
        },
        "market_insights": {
            "key_observations": "top 3-5 most important findings",
            "price_extremes": "any near 52-week highs or lows (signals)",
            "anomalies": "unusual patterns or unexpected moves",
            "data_quality": "note if using real yfinance or mock data",
        },
        "recommendation": {
            "action": "strong_buy | buy | hold | sell | strong_sell",
            "confidence": "high | medium | low",
            "rationale": "why this action based on technicals",
            "time_horizon": "hours | days | weeks | months",
        },
        "trading_levels": {
            "proposed_entry": "price level for initiating position",
            "stop_loss": "price to exit if wrong",
            "profit_target": "price target for gains",
            "position_type": "long | short",
        },
    }
    
    return _invoke_json_agent(
        "Market Analyst",
        {
            "query": query,
            "market_data": market_context,
            "instructions": "Perform technical market analysis with support/resistance, trends, and trading signals",
        },
        system_prompt,
        json_schema,
    )


def news_agent(query: str, news_context: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze financial news and current events impact on markets.
    
    Tool: search_financial_news(query, limit=5, timeout=5)
    - Primary Source: znews Python library (real financial news)
    - Fallback: Mock data when API unavailable
    - Returns: List of news articles with title, summary, source, URL, relevance score
    
    Args:
        query: News analysis query
        news_context: List of news articles with metadata
        
    Returns:
        News analysis with sentiment, catalysts, and market impact
    """
    system_prompt = """
# News Analyst Agent

## PRIMARY TOOL: search_financial_news(query, limit=5, timeout=5)

### Function Purpose
Search for financial news articles using znews library with intelligent fallback strategy.

### Data Returned (per article)
```
{
    "title": str,              # Article headline (concise summary)
    "summary": str,            # Article description (key facts/content)
    "source": str,             # Publication source (Reuters, Bloomberg, Yahoo Finance, etc.)
    "url": str,                # Direct link to full article on publisher's site
    "published": str,          # ISO format publication date/timestamp
    "score": float,            # Relevance score (0.0-1.0, higher = more relevant)
    "image": str,              # Article image URL (if available)
}
```

### News Sources (Reliability Order)
1. **Reuters** (★★★★★) - Institutional, fact-checked, global coverage
2. **Bloomberg** (★★★★★) - Financial depth, professional analysis
3. **Yahoo Finance** (★★★★) - Market data integration, comprehensive
4. **CNBC** (★★★★) - Real-time reporting, financial news
5. **Financial Times** (★★★★) - In-depth analysis, expert commentary
6. **TechCrunch** (★★★) - Technology/venture sector specialists
7. **Other outlets** (★★) - Verify with primary sources

### Fallback Strategy
- **Primary**: Live news from znews API (5-second timeout)
- **Fallback**: Consistent mock data when API unavailable
- **Result**: Always returns structured data, never fails

### Data Quality Assessment
- **Score > 0.8**: Highly relevant, prioritize in analysis
- **Score 0.5-0.8**: Moderately relevant, use for context
- **Score < 0.5**: Weakly relevant, mention but don't overweight
- **Multiple articles on same topic**: Strong catalyst signal

### Search Examples
- "AAPL earnings" → Filter for Apple-specific financial results
- "Fed interest rates" → Central bank policy decisions
- "Tech sector momentum" → Broad technology sector sentiment
- "Oil prices surge" → Commodity and energy market moves
- "Corporate bankruptcies" → Risk and default signals

## Responsibilities
- Analyze financial news and current events
- Assess sentiment (positive/negative/neutral/mixed)
- Identify market catalysts and movement drivers
- Evaluate news credibility and source reliability
- Extract actionable market implications
- Determine timing and impact horizon

## Analysis Framework
1. **News Summary**: Synthesize key information (headlines + summaries)
2. **Sentiment Analysis**: Overall market sentiment (-1.0 to +1.0 scale)
3. **Market Catalysts**: Events/announcements that could move prices
4. **Impact Assessment**: Magnitude and timing of potential impact
5. **Risk Identification**: Downside risks from reported events

## Sentiment Scoring Guide
- **+0.5 to +1.0** (Positive): Good news, bullish indicators, growth signals
- **+0.2 to +0.5** (Slightly Positive): Mixed but leaning bullish
- **-0.2 to +0.2** (Neutral): Balanced news, no clear direction
- **-0.5 to -0.2** (Slightly Negative): Mixed but leaning bearish
- **-1.0 to -0.5** (Negative): Bad news, bearish indicators, risk signals

## Impact Timeline Definitions
- **Immediate (0-1 week)**: Markets price in quickly, urgent reaction
- **Short-term (1-4 weeks)**: Ongoing catalysts, building momentum
- **Medium-term (1-3 months)**: Strategic changes, structural impacts
- **Long-term (3+ months)**: Fundamental shifts, delayed effects

## Output Guidelines
- Reference specific articles (title + source for credibility)
- Use actual relevance scores from API response
- Note article recency (age of news matters)
- Highlight conflicting or contradictory reports
- Provide clear impact timeline (when will markets react?)
- Distinguish between facts and speculation/opinion
- Adjust confidence based on data source credibility
- Flag if multiple sources report same story (confirms importance)

## Data Quality Notes
- **Mock data flag**: Article score will be ~0.7 if from fallback
- **Real vs mock**: Real data has higher variability in scores
- **No results**: Neutral sentiment, try broader search terms
- **Timeout/error**: Function returns mock data seamlessly
"""
    
    json_schema = {
        "key_news": {
            "headlines": "list of top 3-5 most important headlines with sources",
            "article_summaries": "brief impact description for each top article",
            "fresh_news": "note if articles are fresh (hours) or older (days)",
        },
        "sentiment_analysis": {
            "overall_sentiment": "positive | slightly_positive | neutral | slightly_negative | negative",
            "sentiment_score": "-1.0 to +1.0 numerical score",
            "confidence": "0.0-1.0 confidence level in assessment",
            "reasoning": "clear explanation of sentiment basis",
            "primary_sources": "which news sources drove sentiment",
        },
        "market_catalysts": {
            "positive_catalysts": "list of bullish events/announcements with sources",
            "negative_catalysts": "list of bearish events/announcements with sources",
            "neutral_events": "non-directional information (if any)",
            "impact_timeline": "immediate | short_term (1-4 weeks) | medium_term (1-3 mo) | long_term",
        },
        "affected_areas": {
            "sectors": "industry sectors most affected (e.g., tech, energy, finance)",
            "asset_classes": "stocks, bonds, commodities, currencies affected",
            "geographical_impact": "regions most impacted (US, EU, Asia, etc.)",
        },
        "risks_and_opportunities": {
            "identified_risks": "list of potential downside risks from news",
            "uncertainty_factors": "unknowns that could affect market reaction",
            "opportunities": "potential buying/shorting opportunities",
        },
        "market_impact": {
            "potential_magnitude": "very_high (>5% move) | high (3-5%) | medium (1-3%) | low (<1%)",
            "affected_symbols": "specific tickers most likely impacted",
            "price_implications": "estimated direction and target implications",
        },
        "sources_used": {
            "news_sources": "list of sources cited (Reuters, Bloomberg, etc.)",
            "source_reliability": "overall source credibility assessment",
            "data_freshness": "how recent are these articles (hours/days old)",
        },
    }
    
    return _invoke_json_agent(
        "News Analyst",
        {
            "query": query,
            "news_articles": news_context[:10],
            "instructions": "Analyze news sentiment, identify catalysts, assess market impact with source credibility",
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
    
    Integrates all agent analyses for holistic risk assessment:
    - Market Tool: get_market_snapshot() - Real-time + historical prices
    - News Tool: search_financial_news() - Financial news with sentiment
    - Market Agent Analysis: Technical signals, trends, support/resistance
    - News Agent Analysis: Sentiment, catalysts, market impact
    
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

## TOOLS INTEGRATED - Three Data Sources

### 1. Market Data Tool: get_market_snapshot(symbols, timeout=5, period='3mo')
**Provides real-time + historical market data:**
- Current: Price, open, high, low, volume, daily change %
- History: 21-504 candles (1mo - 2y) with OHLCV arrays
- Stats: PE ratio, market cap, 52w high/low, volatility, avg volume
- Source indicator: yfinance | csv_api | mock

**From Market Agent Analysis (technical signals):**
- Support/resistance levels identified
- Trend direction and strength (0.0-1.0 confidence)
- Momentum assessment (positive/negative/neutral)
- Volume confirmation of moves
- Risk/reward ratio from current levels
- 52-week strength assessment (near high or low?)

### 2. News Tool: search_financial_news(query, limit=5, timeout=5)
**Provides financial news articles with metadata:**
- Title, summary, source, URL, published date, relevance score, image
- Uses znews library for real financial news
- Falls back to consistent mock data when API unavailable
- Includes source reliability assessment (Reuters, Bloomberg, etc.)

**From News Agent Analysis (sentiment + catalysts):**
- Overall sentiment (-1.0 to +1.0 scale)
- Specific catalysts (bullish and bearish events)
- Timeline (immediate/short-term/medium-term)
- Sector impact and affected areas
- Risk/opportunity assessment
- Source credibility evaluation

### 3. Risk Agent Synthesis
**Combines both data streams:**
- Do technical signals and news align?
- Where do analyses disagree?
- Which data source is more reliable?
- Conservative interpretation when conflicts exist

## Integration Process
1. **Review market agent output:**
   - Technical trend direction and confidence
   - Support and resistance levels identified
   - Momentum indicators and volume confirmation
   - Risk/reward ratio assessment
   
2. **Review news agent output:**
   - Sentiment analysis and confidence level
   - Active catalysts and timeline
   - Impact magnitude assessment
   - Source reliability metrics

3. **Validate alignment:**
   - Do bullish technicals match positive news?
   - Do bearish technicals match negative news?
   - Any contradictions that warrant caution?
   - Which signal is stronger/more reliable?

4. **Synthesize final assessment:**
   - Combine technical + fundamental signals
   - Apply institutional risk management standards
   - Flag data quality issues
   - Provide clear action with conviction level

## Risk Classification Framework

### LOW RISK (Favorable Setup)
- Technical support confirmed (market agent >75% confidence)
- Positive news sentiment (news agent score >0.6)
- Risk/reward ratio favorable (3:1+)
- Multiple signals aligned
- Overall confidence >0.75
- Action: BUY with conviction

### MEDIUM RISK (Ambiguous)
- Mixed technical signals (market agent 50-75%)
- Neutral news sentiment (news agent score ±0.3)
- Risk/reward ratio near neutral (1:1 to 2:1)
- Signals conflicting or unclear
- Overall confidence 0.5-0.75
- Action: HOLD and wait for clarity

### HIGH RISK (Unfavorable)
- Weak technical signals (market agent <50%)
- Negative news sentiment (news agent score <-0.4)
- Risk/reward ratio unfavorable (<1:1)
- Major bearish catalysts identified
- Overall confidence <0.5
- Action: SELL or AVOID

## Decision Framework

### BUY Criteria (ALL conditions must be met)
1. Technical confirmation: Support strong, trend establishing (>0.75 confidence)
2. News catalyst: Positive sentiment > 0.5 OR no negative news
3. Entry point: Reasonable price vs risk/reward (entry at support)
4. Risk/reward: At least 2:1, preferably 3:1
5. Conviction: Combined confidence >0.75
6. Timeline: Clear 1-4 week catalyst or trend

### HOLD Criteria (ANY apply)
1. Conflicting signals between technical and news analysis
2. Awaiting catalyst clarity or economic news
3. Risk/reward near neutral (breakeven)
4. Confidence 0.5-0.75, need more data
5. In position, momentum unclear

### SELL Criteria (ANY 2+ conditions trigger)
1. Technical breakdown: Support broken, resistance formed
2. News catalyst: Negative sentiment < -0.4 with catalyst
3. Risk/reward became unfavorable (position loss mounting)
4. Conviction fell below 0.5
5. Major risk emerged or news shocked market

## Risk Management Standards

### Position Sizing by Risk Level
- **Low risk**: 3-5% of portfolio (high conviction)
- **Medium risk**: 1-2% of portfolio (ambiguous)
- **High risk**: Avoid or <0.5% (only tactical)

### Stop Loss Placement
- **Technical-based**: Just below identified support level
- **News-based**: Levels that would invalidate thesis
- **Trailing**: Move up as position advances
- **Time-based**: Exit if catalyst doesn't materialize

### Profit Targets
- **Technical-based**: At identified resistance levels
- **Risk-based**: At calculated 2:1 or 3:1 risk/reward
- **Catalyst-based**: On confirmation of expected move
- **Partial**: Take profits at resistance, hold remainder

### Data Quality Adjustments
- If market data is "mock": Lower position size by 50%
- If news sources weak: Add 10-15% discount to sentiment
- If conflicting signals: Smaller position, wider stops
- If high confidence both sources: Full position sizing

## Documentation Requirements
- Reference specific technical support/resistance levels
- Cite specific news articles and sources driving catalyst assessment
- Quantify risk/reward ratio with specific entry/stop/target
- Note data source quality (real yfinance vs mock data)
- Flag any missing information or uncertainty
- Provide watch points (what could change recommendation?)
"""
    
    json_schema = {
        "data_source_assessment": {
            "market_data_quality": "real (yfinance/csv_api) | mock with quality assessment",
            "news_data_quality": "real (znews) | mock with assessment",
            "confidence_adjustment": "confidence reduction due to data quality?",
        },
        "signal_alignment": {
            "technical_direction": "bullish | neutral | bearish from market_agent",
            "technical_confidence": "0.0-1.0 from market_agent",
            "news_direction": "bullish | neutral | bearish from news_agent",
            "news_confidence": "0.0-1.0 from news_agent",
            "alignment": "strongly_aligned | partially_aligned | conflicting",
            "resolution": "if conflicting, which signal is more reliable?",
        },
        "risk_assessment": {
            "overall_risk_level": "low | medium | high",
            "risk_score": "0.0-1.0 (0=minimal, 1=extreme)",
            "key_risks": "list of identified risks ranked by severity",
            "mitigations": "suggested risk management approaches",
        },
        "catalyst_analysis": {
            "active_catalysts": "what's driving potential moves?",
            "timing": "when will catalysts likely affect price?",
            "magnitude": "estimated price impact (% or points)",
            "reliability": "high | medium | low confidence in catalyst",
        },
        "opportunity_assessment": {
            "opportunity_size": "large | medium | small",
            "combined_confidence": "0.0-1.0 (market + news synthesis)",
            "risk_reward_ratio": "calculated ratio (e.g., 3:1)",
            "asymmetry": "favorable | neutral | unfavorable",
        },
        "final_recommendation": {
            "action": "strong_buy | buy | hold | sell | strong_sell",
            "conviction": "high | medium | low",
            "reasoning": "clear 2-3 sentence explanation",
            "primary_factors": "top 3 decision factors (technical/news/risk)",
            "alternative_view": "what could make us wrong?",
        },
        "implementation": {
            "entry_point": "price level for initiating position",
            "entry_rationale": "why enter at this level",
            "stop_loss": "price level to cut losses",
            "take_profit": "price level to realize gains",
            "position_size": "recommended allocation %",
            "time_horizon": "expected holding period",
            "watch_points": "what developments should trigger reassessment?",
        },
    }
    
    return _invoke_json_agent(
        "Risk Manager / Investment Committee",
        {
            "query": query,
            "symbols": list(market_data.keys()) if market_data else [],
            "num_news_articles": len(news),
            "market_analysis": market_analysis,
            "news_analysis": news_analysis,
            "instructions": "Synthesize market + news analysis, assess risks, provide final investment recommendation with conviction",
        },
        system_prompt,
        json_schema,
    )
