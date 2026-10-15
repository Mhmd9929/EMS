/**
 * Tiny, safe arithmetic formula language for pay components — no eval().
 *
 *   expr   := term (('+' | '-') term)*
 *   term   := factor (('*' | '/') factor)*
 *   factor := NUMBER | IDENT | IDENT '(' args ')' | '(' expr ')' | '-' factor
 *
 * Identifiers are component codes (e.g. BASIC) whose values are monthly amounts in major units (AED).
 * Functions: min, max, round(x [, decimals]), floor, ceil, abs.
 */
type Node =
  | { t: "num"; v: number }
  | { t: "var"; name: string }
  | { t: "neg"; e: Node }
  | { t: "bin"; op: "+" | "-" | "*" | "/"; l: Node; r: Node }
  | { t: "call"; fn: string; args: Node[] };

const FUNCTIONS: Record<string, (...a: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  floor: Math.floor,
  ceil: Math.ceil,
  abs: Math.abs,
  round: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d,
};

export class FormulaError extends Error {}

function tokenize(src: string) {
  const tokens: string[] = [];
  const re = /\s*(\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|[-+*/(),])/y;
  let i = 0;
  while (i < src.length) {
    if (/\s/.test(src[i])) {
      i++;
      continue;
    }
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) throw new FormulaError(`Unexpected character "${src[i]}" at position ${i + 1}`);
    tokens.push(m[1]);
    i = re.lastIndex;
  }
  return tokens;
}

export function parseFormula(src: string): Node {
  if (src.length > 500) throw new FormulaError("Formula is too long");
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expect = (tok: string) => {
    if (next() !== tok) throw new FormulaError(`Expected "${tok}"`);
  };
  const expr = (): Node => {
    let l = term();
    while (peek() === "+" || peek() === "-") l = { t: "bin", op: next() as "+" | "-", l, r: term() };
    return l;
  };
  const term = (): Node => {
    let l = factor();
    while (peek() === "*" || peek() === "/") l = { t: "bin", op: next() as "*" | "/", l, r: factor() };
    return l;
  };
  const factor = (): Node => {
    const tok = next();
    if (tok === undefined) throw new FormulaError("Unexpected end of formula");
    if (tok === "-") return { t: "neg", e: factor() };
    if (tok === "(") {
      const e = expr();
      expect(")");
      return e;
    }
    if (/^\d/.test(tok)) return { t: "num", v: Number(tok) };
    if (/^[A-Za-z_]/.test(tok)) {
      if (peek() === "(") {
        const fn = tok.toLowerCase();
        if (!FUNCTIONS[fn]) throw new FormulaError(`Unknown function "${tok}"`);
        next();
        const args: Node[] = [];
        if (peek() !== ")") {
          args.push(expr());
          while (peek() === ",") {
            next();
            args.push(expr());
          }
        }
        expect(")");
        return { t: "call", fn, args };
      }
      return { t: "var", name: tok.toUpperCase() };
    }
    throw new FormulaError(`Unexpected "${tok}"`);
  };
  const ast = expr();
  if (pos !== tokens.length) throw new FormulaError(`Unexpected "${tokens[pos]}"`);
  return ast;
}

export function formulaVariables(src: string): string[] {
  const out = new Set<string>();
  const walk = (n: Node) => {
    if (n.t === "var") out.add(n.name);
    else if (n.t === "neg") walk(n.e);
    else if (n.t === "bin") {
      walk(n.l);
      walk(n.r);
    }
    else if (n.t === "call") n.args.forEach(walk);
  };
  walk(parseFormula(src));
  return [...out];
}

export function evaluateFormula(src: string, vars: Record<string, number>): number {
  const ev = (n: Node): number => {
    switch (n.t) {
      case "num":
        return n.v;
      case "var":
        if (!(n.name in vars)) throw new FormulaError(`Unknown component "${n.name}"`);
        return vars[n.name];
      case "neg":
        return -ev(n.e);
      case "call":
        return FUNCTIONS[n.fn](...n.args.map(ev));
      case "bin": {
        const l = ev(n.l);
        const r = ev(n.r);
        if (n.op === "/" && r === 0) throw new FormulaError("Division by zero");
        return n.op === "+" ? l + r : n.op === "-" ? l - r : n.op === "*" ? l * r : l / r;
      }
    }
  };
  const result = ev(parseFormula(src));
  if (!Number.isFinite(result)) throw new FormulaError("Formula result is not a number");
  return result;
}

/**
 * Evaluate several formulas that may reference each other, in dependency order.
 * `fixed` are known values; returns all values (fixed + computed). Throws on cycles.
 */
export function resolveFormulas(fixed: Record<string, number>, formulas: Record<string, string>): Record<string, number> {
  const values = { ...fixed };
  const state = new Map<string, "visiting" | "done">();
  const visit = (code: string, path: string[]) => {
    if (state.get(code) === "done") return;
    if (state.get(code) === "visiting") throw new FormulaError(`Circular formula: ${[...path, code].join(" → ")}`);
    state.set(code, "visiting");
    for (const dep of formulaVariables(formulas[code])) {
      if (dep in formulas) visit(dep, [...path, code]);
    }
    values[code] = evaluateFormula(formulas[code], values);
    state.set(code, "done");
  };
  for (const code of Object.keys(formulas)) visit(code, []);
  return values;
}
