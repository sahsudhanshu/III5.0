import { redirect } from "next/navigation";

export default function MarketSymbolRedirect({ params }: { params: { symbol: string } }) {
  redirect(`/explore/${params.symbol}`);
}
