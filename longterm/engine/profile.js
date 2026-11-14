// Business profile: which "mode" the company is judged in, and a plain-English description.

const MODES = {
  etf: { label: "ETF / fund", explain: "A basket of securities. Fundamentals are not scored; judge fees, what it tracks, and the chart.", keyMetrics: ["expense ratio", "what it tracks", "trend"], ignored: ["all company ratios"] },
  bank: { label: "Bank / lender / fintech", explain: "Judged like a bank: revenue and net income growth, return on equity and assets, book value growth, credit quality, price-to-book. EBITDA and free cash flow are not meaningful.", keyMetrics: ["revenue growth", "net income", "ROE", "ROA", "book value / share growth", "P/B", "P/E"], ignored: ["EBITDA", "free cash flow", "EV/EBITDA", "P/FCF"] },
  insurance: { label: "Insurance", explain: "Judged on premium growth, combined ratio, book value growth, ROE and price-to-book. Cash flow is lumpy by nature.", keyMetrics: ["revenue growth", "ROE", "book value / share growth", "P/B"], ignored: ["EBITDA", "P/FCF"] },
  reit: { label: "REIT / real estate", explain: "Judged on funds from operations, occupancy, dividend coverage and debt. Net income understates cash earnings because of depreciation.", keyMetrics: ["revenue growth", "operating cash flow", "dividend record", "debt / equity"], ignored: ["net margin", "P/E"] },
  software: { label: "Software / internet platform", explain: "Judged on revenue growth, gross margin, free-cash-flow margin, dilution, and price-to-sales / price-to-FCF.", keyMetrics: ["revenue growth", "gross margin", "FCF margin", "Rule of 40", "share dilution", "P/S", "P/FCF"], ignored: ["P/B"] },
  semis: { label: "Semiconductor / hardware", explain: "Cyclical. Judged on gross and operating margin through the cycle, inventory, capital intensity, EV/EBITDA and forward P/E.", keyMetrics: ["revenue growth", "gross margin", "operating margin", "FCF", "EV/EBITDA", "forward P/E"], ignored: ["P/B"] },
  biotech: { label: "Biotech / pharma", explain: "Pre-profit biotechs are judged on cash runway and pipeline (not scored here); profitable pharma on margins, FCF and patent cliffs.", keyMetrics: ["cash runway", "revenue growth", "FCF"], ignored: ["P/E when unprofitable"] },
  energy: { label: "Energy / materials", explain: "Commodity-driven. Judged on FCF through the cycle, debt, dividends/buybacks, and EV/EBITDA rather than growth.", keyMetrics: ["FCF", "net debt / EBITDA", "shareholder returns", "EV/EBITDA"], ignored: ["revenue growth consistency"] },
  consumer: { label: "Consumer brand / retail", explain: "Judged on same-store style growth, gross margin stability (pricing power), FCF, and P/E.", keyMetrics: ["revenue growth", "gross margin stability", "FCF", "P/E"], ignored: [] },
  general: { label: "General operating company", explain: "Judged on growth, margins, free cash flow, balance sheet and conventional multiples.", keyMetrics: ["revenue growth", "operating margin", "FCF margin", "net debt", "P/E", "P/FCF"], ignored: [] },
};

export function classifyBusiness({ sector = "", industry = "", description = "", quoteType = "", name = "" }) {
  const s = String(sector ?? "").toLowerCase();
  const i = String(industry ?? "").toLowerCase();
  const d = `${description ?? ""} ${name ?? ""}`.toLowerCase();
  let mode = "general";
  if (/etf|mutualfund|index|fund/i.test(quoteType)) mode = "etf";
  else if (/insurance/.test(i)) mode = "insurance";
  else if (/reit|real estate/.test(i) || /real estate/.test(s)) mode = "reit";
  else if (/bank|credit services|consumer finance|mortgage finance|capital markets|lending|financial data|asset management/.test(i) || /financial services|financials/.test(s)) mode = "bank";
  else if (/semiconductor|electronic components|computer hardware|scientific & technical instruments/.test(i)) mode = "semis";
  else if (/software|internet content|information technology services|electronic gaming|interactive media/.test(i)) mode = "software";
  else if (/biotechnology|drug manufacturers|pharmaceutical|medical devices/.test(i)) mode = "biotech";
  else if (/oil|gas|coal|uranium|mining|gold|silver|copper|steel|chemicals|energy/.test(i) || /energy|basic materials/.test(s)) mode = "energy";
  else if (/consumer|retail|restaurant|apparel|beverage|food|household|leisure|auto manufacturers|packaged/.test(i) || /consumer cyclical|consumer defensive/.test(s)) mode = "consumer";
  else if (!i && !s) {
    // No sector data (e.g. some Canadian listings): fall back to description keywords.
    if (/\betf\b|index fund|trust units/.test(d)) mode = "etf";
    else if (/\bsemiconductor|\bwafer|\bfoundry|\bgpu\b/.test(d)) mode = "semis";
    else if (/saas|cloud platform|subscription software|software/.test(d)) mode = "software";
    else if (/\bbank\b|lender|loans|deposits/.test(d)) mode = "bank";
  }
  return { mode, ...MODES[mode] };
}

function firstSentences(text, count = 2) {
  const sentences = String(text ?? "").replace(/\s+/g, " ").match(/[^.!?]+[.!?]+/g) ?? [];
  return sentences.slice(0, count).map((x) => x.trim()).join(" ").trim();
}

export function describeBusiness(snapshot, profile) {
  const summary = firstSentences(snapshot.description, 3);
  if (profile.mode === "etf") return summary || `${snapshot.name ?? snapshot.symbol} is a fund. Check what it tracks and its fees.`;
  const sector = [snapshot.sector, snapshot.industry].filter(Boolean).join(" / ");
  return `${summary || `${snapshot.name ?? snapshot.symbol} operates in ${sector || "an unclassified industry"}.`} Scanner mode: ${profile.label}. ${profile.explain}`;
}
