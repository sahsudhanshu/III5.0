import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Sentiment = "positive" | "negative" | "neutral";

const POSITIVE_TERMS = [
  "beat",
  "surge",
  "rally",
  "jump",
  "gain",
  "upgrade",
  "record high",
  "strong",
  "growth",
  "profit rises",
];

const NEGATIVE_TERMS = [
  "miss",
  "drop",
  "fall",
  "decline",
  "slump",
  "crash",
  "downgrade",
  "warning",
  "lawsuit",
  "loss widens",
];

function inferSentiment(text: string): Sentiment {
  const t = text.toLowerCase();
  if (POSITIVE_TERMS.some((k) => t.includes(k))) return "positive";
  if (NEGATIVE_TERMS.some((k) => t.includes(k))) return "negative";
  return "neutral";
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function pickTag(item: string, tag: string): string {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeHtmlEntities(stripCdata(match[1].trim())) : "";
}

function parseRss(xml: string, limit: number) {
  const itemRegex = /<item[\s\S]*?>[\s\S]*?<\/item>/gi;
  const items = xml.match(itemRegex) ?? [];

  return items.slice(0, limit).map((raw) => {
    const title = pickTag(raw, "title");
    const url = pickTag(raw, "link");
    const summary = pickTag(raw, "description");
    const published = pickTag(raw, "pubDate");
    const source = pickTag(raw, "source") || "Bing News";

    return {
      title,
      summary,
      source,
      url,
      published,
      sentiment: inferSentiment(`${title} ${summary}`),
      feedType: "live" as const,
    };
  }).filter((a) => a.title);
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "finance").trim();
  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? "15");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 30) : 15;

  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (III5 News Fetcher)" },
    });
    if (!res.ok) {
      return NextResponse.json(
        { articles: [], error: `Upstream HTTP ${res.status}` },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const xml = await res.text();
    const articles = parseRss(xml, limit);

    return NextResponse.json(
      { articles, query: q, count: articles.length },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { articles: [], error: String(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

