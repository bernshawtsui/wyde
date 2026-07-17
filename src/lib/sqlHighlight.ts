/**
 * A small, dependency-free SQL tokenizer for read-only syntax highlighting.
 *
 * It is deliberately dialect-agnostic and lenient: the worst failure mode for
 * a viewer is a token wearing the wrong color, never a crash or lost text. The
 * concatenation of every token's `value` always equals the input exactly, so
 * the rendered view is byte-for-byte the source.
 */

export type SqlTokenType =
  | "keyword"
  | "string"
  | "number"
  | "comment"
  | "plain";

export interface SqlToken {
  type: SqlTokenType;
  value: string;
}

// Common SQL keywords across dialects (clauses, DDL/DML, operators, types).
// Matched case-insensitively against whole identifier runs. Built-in function
// names are intentionally omitted — they read fine as plain identifiers.
// prettier-ignore
const KEYWORDS = new Set<string>([
  "ADD", "ALL", "ALTER", "AND", "ANY", "AS", "ASC", "BEGIN", "BETWEEN", "BY",
  "CASE", "CAST", "CHECK", "COLUMN", "COMMIT", "CONSTRAINT", "CREATE",
  "CROSS", "CURRENT", "DATABASE", "DEFAULT", "DELETE", "DESC", "DISTINCT",
  "DROP", "ELSE", "END", "EXCEPT", "EXISTS", "EXPLAIN", "FALSE", "FETCH",
  "FOREIGN", "FROM", "FULL", "GRANT", "GROUP", "HAVING", "IF", "ILIKE", "IN",
  "INDEX", "INNER", "INSERT", "INTERSECT", "INTO", "IS", "JOIN", "KEY",
  "LATERAL", "LEFT", "LIKE", "LIMIT", "NATURAL", "NOT", "NULL", "NULLS",
  "OFFSET", "ON", "OR", "ORDER", "OUTER", "OVER", "PARTITION", "PRIMARY",
  "QUALIFY", "RECURSIVE", "REFERENCES", "RENAME", "REPLACE", "RETURNING",
  "REVOKE", "RIGHT", "ROLLBACK", "ROW", "ROWS", "SELECT", "SET", "SOME",
  "TABLE", "THEN", "TO", "TRANSACTION", "TRUE", "TRUNCATE", "UNION", "UNIQUE",
  "UNNEST", "UPDATE", "USING", "VALUES", "VIEW", "WHEN", "WHERE", "WINDOW",
  "WITH",
  // Common types
  "ARRAY", "BIGINT", "BINARY", "BLOB", "BOOL", "BOOLEAN", "CHAR", "DATE",
  "DATETIME", "DECIMAL", "DOUBLE", "FLOAT", "INT", "INTEGER", "JSON", "MAP",
  "NUMERIC", "PRECISION", "REAL", "SMALLINT", "STRING", "STRUCT", "TEXT",
  "TIME", "TIMESTAMP", "TINYINT", "UUID", "VARCHAR",
]);

function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}

function isIdentStart(c: string): boolean {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
}

function isIdentChar(c: string): boolean {
  return isIdentStart(c) || isDigit(c) || c === "$";
}

/**
 * Split SQL `src` into a flat list of colored tokens. Runs that need no color
 * (whitespace, punctuation, operators, ordinary identifiers) are coalesced
 * into `plain` tokens so the output stays compact.
 */
export function tokenizeSql(src: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  const n = src.length;
  let i = 0;
  let plainStart = 0;

  const flushPlain = (end: number) => {
    if (end > plainStart) {
      tokens.push({ type: "plain", value: src.slice(plainStart, end) });
    }
  };

  while (i < n) {
    const c = src[i];

    // Line comment: -- ... to end of line (newline excluded).
    if (c === "-" && src[i + 1] === "-") {
      flushPlain(i);
      let j = i + 2;
      while (j < n && src[j] !== "\n") j++;
      tokens.push({ type: "comment", value: src.slice(i, j) });
      i = j;
      plainStart = i;
      continue;
    }

    // Block comment: /* ... */ (unterminated runs to EOF).
    if (c === "/" && src[i + 1] === "*") {
      flushPlain(i);
      let j = i + 2;
      while (j < n && !(src[j] === "*" && src[j + 1] === "/")) j++;
      j = j < n ? j + 2 : n; // include the closing */ when present
      tokens.push({ type: "comment", value: src.slice(i, j) });
      i = j;
      plainStart = i;
      continue;
    }

    // Single-quoted string. `''` is an embedded quote (SQL standard).
    if (c === "'") {
      flushPlain(i);
      let j = i + 1;
      while (j < n) {
        if (src[j] === "'") {
          if (src[j + 1] === "'") {
            j += 2;
            continue;
          }
          j++;
          break;
        }
        j++;
      }
      tokens.push({ type: "string", value: src.slice(i, j) });
      i = j;
      plainStart = i;
      continue;
    }

    // Double-quoted / backtick delimited identifiers. Scanned as a unit so an
    // apostrophe inside can't start a string, but left plain (they're names,
    // not literals).
    if (c === '"' || c === "`") {
      let j = i + 1;
      while (j < n && src[j] !== c) j++;
      i = j < n ? j + 1 : n;
      continue;
    }

    // Numeric literal. Guard against matching the digits inside an identifier
    // (e.g. `col2`) by requiring the previous char not be an identifier char.
    const prev = i > 0 ? src[i - 1] : "";
    if (
      (isDigit(c) || (c === "." && isDigit(src[i + 1]))) &&
      !isIdentChar(prev)
    ) {
      flushPlain(i);
      let j = i;
      while (j < n && isDigit(src[j])) j++;
      if (src[j] === "." && isDigit(src[j + 1])) {
        j++;
        while (j < n && isDigit(src[j])) j++;
      }
      if (src[j] === "e" || src[j] === "E") {
        let k = j + 1;
        if (src[k] === "+" || src[k] === "-") k++;
        if (isDigit(src[k])) {
          k++;
          while (k < n && isDigit(src[k])) k++;
          j = k;
        }
      }
      tokens.push({ type: "number", value: src.slice(i, j) });
      i = j;
      plainStart = i;
      continue;
    }

    // Identifier or keyword.
    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < n && isIdentChar(src[j])) j++;
      const word = src.slice(i, j);
      if (KEYWORDS.has(word.toUpperCase())) {
        flushPlain(i);
        tokens.push({ type: "keyword", value: word });
        plainStart = j;
      }
      // Non-keyword identifiers stay part of the pending plain run.
      i = j;
      continue;
    }

    i++;
  }

  flushPlain(n);
  return tokens;
}
