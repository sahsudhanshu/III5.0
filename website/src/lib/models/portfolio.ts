import mongoose, { Schema, Document } from "mongoose";

// ── Sub-documents ──────────────────────────────────────────────

export interface IHolding {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  qty: number;
  avgBuyPrice: number;
}

export interface ITransaction {
  id: string;
  type: "BUY" | "SELL" | "DEPOSIT" | "WITHDRAW";
  symbol?: string;
  name?: string;
  qty?: number;
  price?: number;     // per-share price
  amount: number;     // total cash impact (positive = credit, negative = debit)
  fee: number;
  status: "COMPLETED" | "FAILED";
  timestamp: Date;
}

// ── Main Portfolio Document ─────────────────────────────────────

export interface IPortfolio extends Document {
  userId: string;
  cashBalance: number;
  holdings: IHolding[];
  transactions: ITransaction[];
  createdAt: Date;
  updatedAt: Date;
}

const HoldingSchema = new Schema<IHolding>(
  {
    symbol:      { type: String, required: true, uppercase: true },
    name:        { type: String, required: true },
    exchange:    { type: String, default: "NASDAQ" },
    sector:      { type: String, default: "Unknown" },
    qty:         { type: Number, required: true, min: 0 },
    avgBuyPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const TransactionSchema = new Schema<ITransaction>(
  {
    id:        { type: String, required: true },
    type:      { type: String, enum: ["BUY", "SELL", "DEPOSIT", "WITHDRAW"], required: true },
    symbol:    { type: String },
    name:      { type: String },
    qty:       { type: Number },
    price:     { type: Number },
    amount:    { type: Number, required: true },
    fee:       { type: Number, default: 0 },
    status:    { type: String, enum: ["COMPLETED", "FAILED"], default: "COMPLETED" },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const PortfolioSchema = new Schema<IPortfolio>(
  {
    userId:       { type: String, required: true, unique: true, index: true },
    cashBalance:  { type: Number, default: 0, min: 0 },
    holdings:     { type: [HoldingSchema], default: [] },
    transactions: { type: [TransactionSchema], default: [] },
  },
  { timestamps: true }
);

const existingPortfolioModel = mongoose.models.Portfolio as mongoose.Model<IPortfolio> | undefined;
if (existingPortfolioModel) {
  const userIdPath = existingPortfolioModel.schema.path("userId");
  if (userIdPath?.instance !== "String") {
    delete mongoose.models.Portfolio;
  }
}

const Portfolio =
  (mongoose.models.Portfolio as mongoose.Model<IPortfolio> | undefined) ||
  mongoose.model<IPortfolio>("Portfolio", PortfolioSchema);

export default Portfolio;
