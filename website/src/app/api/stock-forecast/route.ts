import { NextResponse } from "next/server";

interface ForecastItem {
  date: string;
  predictedPrice: number;
  baselinePrice: number;
  delta: number;
  deltaPercent: number;
}

interface ForecastResponse {
  symbol: string;
  signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number;
  summary: string;
  forecast: ForecastItem[];
  source: "hf" | "mock";
  generatedAt: string;
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  let t = seed + 0x6d2b79f5;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMockForecast(symbol: string, days = 7, reason?: string): ForecastResponse {
  const seed = hashString(symbol);
  const rand = seededRandom(seed);
  const basePrice = 80 + rand() * 320;
  const drift = (rand() - 0.4) * 0.01;

  const forecast: ForecastItem[] = [];
  let baseline = basePrice;
  let predicted = basePrice;

  for (let i = 1; i <= days; i += 1) {
    baseline = baseline * (1 + drift);
    const noise = (rand() - 0.5) * 0.02;
    predicted = predicted * (1 + drift + noise);

    const delta = predicted - baseline;
    const deltaPercent = baseline === 0 ? 0 : (delta / baseline) * 100;

    const date = new Date();
    date.setDate(date.getDate() + i);

    forecast.push({
      date: date.toISOString(),
      predictedPrice: Number(predicted.toFixed(2)),
      baselinePrice: Number(baseline.toFixed(2)),
      delta: Number(delta.toFixed(2)),
      deltaPercent: Number(deltaPercent.toFixed(2)),
    });
  }

  const trend = forecast[forecast.length - 1].predictedPrice - forecast[0].predictedPrice;
  const signal = trend > 0.5 ? "BULLISH" : trend < -0.5 ? "BEARISH" : "NEUTRAL";
  const confidence = Number((0.55 + rand() * 0.25).toFixed(2));

  return {
    symbol,
    signal,
    confidence,
    summary:
      reason ??
      "Forecast generated with fallback heuristics. Use as directional guidance only.",
    forecast,
    source: "mock",
    generatedAt: new Date().toISOString(),
  };
}

type ForecastRow = Record<string, unknown>;

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const rawSymbol = String(body?.symbol ?? "").trim().toUpperCase();

  if (!rawSymbol) {
    return NextResponse.json({ message: "symbol is required" }, { status: 400 });
  }

  const hfBase =
    process.env.HF_BACKEND_BASE_URL ??
    process.env.NEXT_PUBLIC_HF_BACKEND_BASE_URL ??
    "https://SaqlainSQX-iii5-backend.hf.space";

  const payload = {
    ticker: rawSymbol,
    days: 7,
    news_source: "gnews",
    alpha: 0.05,
    sentiment_decay: 0.85,
    use_gemini: true,
  };

  try {
    const res = await fetch(`${hfBase}/stock-forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!res.ok) {
      let errorDetail = "";
      try {
        const errJson = await res.json();
        errorDetail = errJson?.detail ? ` ${errJson.detail}` : "";
      } catch (error) {
        errorDetail = "";
      }
      console.error(`HF forecast failed (${res.status})${errorDetail}`);
      const reason = `HF forecast failed (${res.status})${errorDetail}`;
      return NextResponse.json(buildMockForecast(rawSymbol, 7, reason));
    }

    const data = await res.json();
    const forecastRows = Array.isArray(data.forecast) ? data.forecast : [];
    if (!forecastRows.length) {
      return NextResponse.json(buildMockForecast(rawSymbol, 7, "HF response empty"));
    }

    const baseDate = new Date();
    const mappedForecast: ForecastItem[] = forecastRows
      .slice(0, 7)
      .map((row: ForecastRow, idx: number) => {
        const baselinePrice = readNumber(
          row.tech_close ?? row.baseline ?? row.base,
          0
        );
        const predictedPrice = readNumber(
          row.ai_close ?? row.predicted ?? row.price,
          baselinePrice
        );
      const delta = predictedPrice - baselinePrice;
      const deltaPercent = baselinePrice === 0 ? 0 : (delta / baselinePrice) * 100;
      const date = new Date(baseDate);
      date.setDate(date.getDate() + idx + 1);
      return {
        date: date.toISOString(),
        predictedPrice: Number(predictedPrice.toFixed(2)),
        baselinePrice: Number(baselinePrice.toFixed(2)),
        delta: Number(delta.toFixed(2)),
        deltaPercent: Number(deltaPercent.toFixed(2)),
      };
      });

    const response: ForecastResponse = {
      symbol: String(data.ticker ?? rawSymbol).toUpperCase(),
      signal: data.signal ?? "NEUTRAL",
      confidence: Number(data.confidence ?? 0.6),
      summary: data.news_summary ?? "Forecast generated from Hugging Face backend.",
      forecast: mappedForecast,
      source: "hf",
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(`HF forecast request failed: ${String(error)}`);
    return NextResponse.json(
      buildMockForecast(rawSymbol, 7, `HF request failed: ${String(error)}`)
    );
  }
}
