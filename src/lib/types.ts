export type Role = "staff" | "manager";

export type Group = { id: string; name: string; hsn: string };

// Old stock about to run out at the current price.
// remainingQty: units left at the CURRENT price (product.price)
// nextMode: what happens once that runs out
// newPrice: the next price (only when nextMode === 'price')
// newPriceQty: optional units at that new price before it also falls back to Ask at Counter (null = stays indefinitely)
export type PriceTransition = {
  remainingQty: number;
  nextMode: "price" | "counter";
  newPrice: number | null;
  newPriceQty: number | null;
};

export type Product = {
  code: string; // serial number, e.g. "1001"
  groupId: string | null;
  name: string;
  price: number; // GST-inclusive
  hsn: string;
  narration: string;
  askAtCounter: boolean;
  adminNote: string; // always "" for customers
  photoUrl: string | null;
  priceTransition: PriceTransition | null;
};

// price === null means that part is priced at the counter
export type PricePart = { qty: number; price: number | null };

export type QuoteItem = {
  code: string;
  name: string;
  qty: number;
  parts: PricePart[];
  lineTotal: number;
  hasCounterPortion: boolean;
  askAtCounter: boolean;
};

export type Quote = {
  id: string;
  number: number;
  dateKey: string;
  customerName: string;
  createdAt: number;
  items: QuoteItem[];
  total: number;
  hasCounterItems: boolean;
};

export type LogEntry = { id: string; ts: number; action: string; details: string; actor: string };

export type EventType = "visit" | "add" | "remove";

export type Settings = { orderingEnabled: boolean };

export type CartLine = { code: string; qty: number };

export type Catalog = { products: Product[]; orderingEnabled: boolean };

export type AdminData = {
  products: Product[];
  groups: Group[];
  settings: Settings;
  nextCode: string;
  idleCodes: number[];
};

export type ProductStat = { code: string; name: string; added: number; removed: number; quotedQty: number };

export type Analytics = {
  range: string;
  totals: { visits: number; adds: number; removes: number; quotes: number; quoteValue: number };
  byHour: { hour: number; visits: number; quotes: number }[]; // store-local hours 0–23
  byWeekday: { day: number; visits: number; quotes: number }[]; // 0 = Sunday
  last14Days: { date: string; visits: number; quotes: number }[];
  topAdded: ProductStat[];
  mostRemoved: ProductStat[];
  rarelySelected: ProductStat[];
};
