/**
 * 2026-04-30 第三輪 Wave C:PII 過濾 helper
 *
 * 設計:
 *   - regex-based(免 LLM call,免費 + 即時)
 *   - 偵測 + 替換 → 回傳 { text, found }
 *   - found = { emails: [], phones: [], idNumbers: [], creditCards: [] }
 *
 * 用法:
 *   const { text: clean, found } = anonymize(rawText);
 *   if (found.length > 0) console.warn("PII detected, replaced:", found);
 *
 * Vincent 紅線 1 風險意識:
 *   - 上傳對話/錄音可能含客戶 PII
 *   - 進 RAG 前先 anonymize 才安全
 *   - UI 應顯示「已偵測到 X 件 PII,已自動替換 ***」讓用戶確認
 */

export interface PIIFindings {
  emails: number;
  phones: number;
  idNumbers: number;          // 台灣身分證
  creditCards: number;
  total: number;
}

const PATTERNS = {
  email: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,
  // 台灣手機 09xx-xxx-xxx / 09xxxxxxxx,固網 0[2-8]-xxxx-xxxx / 0[2-8]xxxxxxxx
  phone: /\b(?:09\d{2}[-\s]?\d{3}[-\s]?\d{3}|0[2-8][-\s]?\d{3,4}[-\s]?\d{4})\b/g,
  // 台灣身分證 1 字 9 數
  idNumber: /\b[A-Z][12]\d{8}\b/g,
  // 信用卡 16 數(可帶分隔)
  creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
};

const REPLACEMENTS: Record<keyof typeof PATTERNS, string> = {
  email: "[EMAIL]",
  phone: "[PHONE]",
  idNumber: "[ID]",
  creditCard: "[CARD]",
};

export interface AnonymizeResult {
  text: string;
  found: PIIFindings;
  hasPII: boolean;
}

export function anonymize(raw: string): AnonymizeResult {
  if (!raw || raw.length === 0) {
    return { text: raw, found: { emails: 0, phones: 0, idNumbers: 0, creditCards: 0, total: 0 }, hasPII: false };
  }

  let text = raw;
  const found: PIIFindings = { emails: 0, phones: 0, idNumbers: 0, creditCards: 0, total: 0 };

  // 順序重要:credit card 先(4 段 16 位)避免被 phone 誤抓
  const creditMatches = text.match(PATTERNS.creditCard);
  if (creditMatches) {
    found.creditCards = creditMatches.length;
    text = text.replace(PATTERNS.creditCard, REPLACEMENTS.creditCard);
  }

  const idMatches = text.match(PATTERNS.idNumber);
  if (idMatches) {
    found.idNumbers = idMatches.length;
    text = text.replace(PATTERNS.idNumber, REPLACEMENTS.idNumber);
  }

  const emailMatches = text.match(PATTERNS.email);
  if (emailMatches) {
    found.emails = emailMatches.length;
    text = text.replace(PATTERNS.email, REPLACEMENTS.email);
  }

  const phoneMatches = text.match(PATTERNS.phone);
  if (phoneMatches) {
    found.phones = phoneMatches.length;
    text = text.replace(PATTERNS.phone, REPLACEMENTS.phone);
  }

  found.total = found.emails + found.phones + found.idNumbers + found.creditCards;
  return { text, found, hasPII: found.total > 0 };
}

/**
 * 只偵測,不替換(讓 UI 提示用戶要不要保留 raw)
 */
export function detectPII(raw: string): PIIFindings {
  if (!raw) return { emails: 0, phones: 0, idNumbers: 0, creditCards: 0, total: 0 };
  const found: PIIFindings = {
    emails: (raw.match(PATTERNS.email) || []).length,
    phones: (raw.match(PATTERNS.phone) || []).length,
    idNumbers: (raw.match(PATTERNS.idNumber) || []).length,
    creditCards: (raw.match(PATTERNS.creditCard) || []).length,
    total: 0,
  };
  found.total = found.emails + found.phones + found.idNumbers + found.creditCards;
  return found;
}
