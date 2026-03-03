function yr(s, e) {
  let t = (s + " " + e).toLowerCase(),
    r = [
      "before",
      "after",
      "when",
      "in 2024",
      "in 2023",
      "in 2022",
      "sometimes",
      "usually",
      "often",
      "rarely",
      "in some cases",
      "historically",
      "recently",
      "traditionally",
      "in the future",
      "depending on",
      "under certain",
      "in certain contexts",
    ];
  for (let a of r) if (t.includes(a)) return "scope";
  let n = [
    "means",
    "defined as",
    "is a",
    "technically",
    "literally",
    "by definition",
    "what is",
    "definition of",
    "the term",
    "semantically",
    "conceptually",
  ];
  for (let a of n) if (t.includes(a)) return "definitional";
  let i = [
    "should",
    "better",
    "worse",
    "i think",
    "right",
    "wrong",
    "good",
    "bad",
    "prefer",
    "ought",
    "must",
    "ideal",
    "important",
    "matters",
    "valuable",
    "worth",
  ];
  for (let a of i) if (t.includes(a)) return "value";
  return "factual";
}
function wr(s) {
  switch (s) {
    case "scope":
      return "boundary_conditions";
    case "definitional":
    case "value":
      return "complementary_integration";
    default:
      return "ontological_transcendence";
  }
}
var ks = {
    positive: [
      /\d+(\.\d+)?%/g,
      /\b(because|therefore|since|given)\b/gi,
      /\b(measured|tested|observed|found)\b/gi,
      /\b(specifically|exactly|precisely)\b/gi,
      /\b(data|evidence|research|study)\b/gi,
      /\b(first|second|third|then|next)\b/gi,
      /\b(if|when|unless|until)\b/gi,
      /```[\s\S]*?```/g,
    ],
    negative: [
      /\b(maybe|perhaps|possibly|might)\b/gi,
      /\b(I think|I feel|I believe)\b/gi,
      /\b(sort of|kind of|a bit)\b/gi,
      /!{2,}/g,
    ],
  },
  Ps = {
    positive: [
      /\b(matters|important|care|love|hate)\b/gi,
      /\b(honestly|truthfully|genuinely)\b/gi,
      /\b(struggle|fight|push|resist|hold)\b/gi,
      /\b(we|us|our|together)\b/gi,
      /\b(why|purpose|meaning|point)\b/gi,
      /[.!?]\s*[A-Z]/g,
      /\b(but|however|yet|though)\b/gi,
    ],
    negative: [
      /\b(as an AI|I cannot|I don't have feelings)\b/gi,
      /\b(certainly|absolutely|definitely)\b/gi,
      /\b(happy to help|glad to assist)\b/gi,
      /\b(it's worth noting|it should be noted)\b/gi,
      /\b(comprehensive|robust|streamlined)\b/gi,
    ],
  },
  vs = [
    /\b(pain|grief|loss|trauma|wound|scar)\b/gi,
    /\b(broke|broken|shattered|destroyed|ruined)\b/gi,
    /\b(failed|failure|mistake|wrong|regret)\b/gi,
    /\b(angry|furious|rage|resentment|bitter)\b/gi,
    /\b(afraid|terrified|scared|dread|fear)\b/gi,
    /\b(lonely|isolated|abandoned|betrayed)\b/gi,
    /\b(exhausted|burnt|depleted|empty|hollow)\b/gi,
  ],
  Rs = [
    /\b(wonder|awe|marvel|astonish|breathtaking)\b/gi,
    /\b(grace|gratitude|grateful|blessed|gift)\b/gi,
    /\b(sacred|holy|reverence|divine|spirit)\b/gi,
    /\b(surrender|let\s*go|release|acceptance|peace)\b/gi,
    /\b(presence|stillness|witness|awakening)\b/gi,
    /\b(beauty|beautiful|luminous|radiant|glow)\b/gi,
    /\b(play|playful|joy|delight|celebrate)\b/gi,
  ];
function xr(s, e = 0, t = 1) {
  return Math.max(e, Math.min(t, s));
}
function _r(s, e) {
  let t = 0,
    r = 0,
    n = s.split(/\s+/).length;
  for (let a of e.positive) {
    let c = s.match(new RegExp(a.source, a.flags));
    t += c?.length ?? 0;
  }
  for (let a of e.negative) {
    let c = s.match(new RegExp(a.source, a.flags));
    r += c?.length ?? 0;
  }
  let i = (t - r * 0.7) / Math.max(n / 10, 1);
  return xr(i * 0.3 + 0.4);
}
function Sr(s, e) {
  let t = s.split(/\s+/).length,
    r = 0;
  for (let n of e) {
    let i = s.match(new RegExp(n.source, n.flags));
    r += i?.length ?? 0;
  }
  return xr(r / Math.max(t / 15, 1));
}
function Ms(s, e, t) {
  let { factual: r, felt: n } = s;
  return r > 0.4 && n > 0.4 && t > 0.4
    ? "luminous"
    : r > 0.45 && n > 0.4 && e > 0.3
      ? "dark"
      : r > 0.5 && n > 0.5
        ? "alive"
        : r > 0.5 && n < 0.35
          ? "grey"
          : r > 0.6 && n < 0.25
            ? "black"
            : r > 0.45 && n < 0.4 && n > 0.25
              ? "silver"
              : n > 0.5 && r < 0.35
                ? "white"
                : "alive";
}
function Ts(s, e) {
  switch (s) {
    case "alive":
      return e.factual > e.felt + 0.15
        ? "#4169E1"
        : e.felt > e.factual + 0.15
          ? "#DC143C"
          : e.convergence > 0.8
            ? "#9370DB"
            : "#228B22";
    case "luminous":
      return "#FFD700";
    case "dark":
      return "#8B0000";
    case "grey":
      return "#808080";
    case "black":
      return "#1a1a1a";
    case "silver":
      return "#C0C0C0";
    case "white":
      return "#F5F5DC";
    case "unscored":
      return "#808080";
  }
}
function As(s, e) {
  switch (s) {
    case "alive":
      return `Both strands active (F:${e.factual.toFixed(2)} M:${e.felt.toFixed(2)}). Convergence: ${e.convergence.toFixed(2)}.`;
    case "luminous":
      return "Luminous: both strands active and touching something transcendent.";
    case "dark":
      return "Dark alive: both strands active but the valence is negative. Present with pain.";
    case "grey":
      return `Grey: factual content present (${e.factual.toFixed(2)}) but meaning strand is dead (${e.felt.toFixed(2)}). Performing, not present.`;
    case "black":
      return "Black: high output with corrupted meaning. Building without caring why.";
    case "silver":
      return "Silver: clean factual, thin meaning. Functional. Polished. Cold.";
    case "white":
      return "White: meaning present but ungrounded. Needs more facts.";
    case "unscored":
      return "Insufficient signal.";
  }
}
function kr(s) {
  if (s.length < 20)
    return {
      strands: { factual: 0, felt: 0, convergence: 0, tension: 0 },
      aliveState: "unscored",
      color: "#808080",
      diagnosis: "Insufficient text to score.",
      warnings: [],
    };
  let e = _r(s, ks),
    t = _r(s, Ps),
    r = Sr(s, vs),
    n = Sr(s, Rs),
    i = 1 - Math.abs(e - t),
    a = Math.abs(e - t),
    c = { factual: e, felt: t, convergence: i, tension: a },
    l = Ms(c, r, n),
    d = Ts(l, c),
    p = As(l, c),
    b = [];
  return (
    (l === "grey" || l === "black") &&
      b.push("Output may be technically correct but nobody's home. Check the soul."),
    a > 0.4 &&
      b.push(`High strand tension (${a.toFixed(2)}). Factual and felt saying different things.`),
    { strands: c, aliveState: l, color: d, diagnosis: p, warnings: b }
  );
}
var Es = [
  { pattern: /nature\.com|pubmed|arxiv\.org|doi\.org/i, tier: "peer_review", base: 0.9 },
  { pattern: /\.gov|who\.int|europa\.eu|cdc\.gov/i, tier: "original_document", base: 0.85 },
  { pattern: /reuters|bbc\.com|nytimes\.com|wsj\.com|economist\.com/i, tier: "news", base: 0.6 },
  { pattern: /medium\.com|substack\.com|ghost\.io/i, tier: "blog", base: 0.4 },
  { pattern: /reddit\.com|stackoverflow\.com|quora\.com/i, tier: "forum", base: 0.3 },
];
function Bs(s) {
  if (!s) return { tier: "anonymous", credibilityScore: 0.1, assessed: new Date().toISOString() };
  for (let { pattern: e, tier: t, base: r } of Es)
    if (e.test(s))
      return { url: s, tier: t, credibilityScore: r, assessed: new Date().toISOString() };
  return { url: s, tier: "anonymous", credibilityScore: 0.1, assessed: new Date().toISOString() };
}
var j = [],
  Pr = !1,
  Ct = "silverado_claims",
  vr = 200;
async function st() {
  if (Pr) return;
  ((j = (await chrome.storage.local.get([Ct]))[Ct] || []), (Pr = !0));
}
async function Ot() {
  (j.length > vr && (j = j.slice(-vr)), await chrome.storage.local.set({ [Ct]: j }));
}
async function Rr(s, e, t, r, n = {}) {
  await st();
  let i = Bs(n.sourceUrl),
    a = 0.5 + i.credibilityScore * 0.5,
    c = Math.max(1, Math.min(5, Math.round(e * a))),
    l = {
      id: `claim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: s,
      confidence: c,
      decayedConfidence: c,
      session: t,
      turn: r,
      status: "active",
      verified: !1,
      contradicted: !1,
      createdAt: new Date().toISOString(),
      source: i,
      confidenceReason: n.confidenceReason || "source",
    };
  return (j.push(l), await Ot(), l);
}
async function Mr(s, e, t, r, n, i) {
  await st();
  let a = {
    id: `claim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: s,
    confidence: Math.max(1, Math.min(5, Math.round(e))),
    decayedConfidence: Math.max(1, Math.min(5, Math.round(e))),
    session: t,
    turn: r,
    status: "active",
    verified: !1,
    contradicted: !1,
    createdAt: new Date().toISOString(),
    confidenceReason: "synthesis",
    synthesisType: n,
    derivedFrom: i,
  };
  return (j.push(a), await Ot(), a);
}
async function Tr(s) {
  await st();
  let e = j.filter((a) => a.status === "active" && a.decayedConfidence >= 3),
    t = s.toLowerCase(),
    r = new Set(t.match(/\b\w{4,}\b/g) || []),
    n = [
      "not",
      "no",
      "never",
      "none",
      "neither",
      "nobody",
      "nothing",
      "isn't",
      "aren't",
      "doesn't",
      "don't",
      "won't",
      "can't",
    ],
    i = (a) => {
      let c = a.toLowerCase();
      return n.some((l) => c.includes(l));
    };
  for (let a of e) {
    let c = a.text.toLowerCase(),
      l = new Set(c.match(/\b\w{4,}\b/g) || []),
      d = 0;
    for (let p of r) l.has(p) && d++;
    if (d >= 2) {
      let p = i(s),
        b = i(a.text);
      if (p !== b) return a;
    }
  }
  return null;
}
async function Ar(s, e) {
  await st();
  let t = j.find((r) => r.id === s);
  t && ((t.status = "contradicted"), (t.contradicted = !0), (t.contradictedBy = e), await Ot());
}
function u(s, e, t, r, n) {
  if (r === "m") throw new TypeError("Private method is not writable");
  if (r === "a" && !n) throw new TypeError("Private accessor was defined without a setter");
  if (typeof e == "function" ? s !== e || !n : !e.has(s))
    throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return (r === "a" ? n.call(s, t) : n ? (n.value = t) : e.set(s, t), t);
}
function o(s, e, t, r) {
  if (t === "a" && !r) throw new TypeError("Private accessor was defined without a getter");
  if (typeof e == "function" ? s !== e || !r : !e.has(s))
    throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return t === "m" ? r : t === "a" ? r.call(s) : r ? r.value : e.get(s);
}
var Ft = function () {
  let { crypto: s } = globalThis;
  if (s?.randomUUID) return ((Ft = s.randomUUID.bind(s)), s.randomUUID());
  let e = new Uint8Array(1),
    t = s ? () => s.getRandomValues(e)[0] : () => (Math.random() * 255) & 255;
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (r) =>
    (+r ^ (t() & (15 >> (+r / 4)))).toString(16),
  );
};
function U(s) {
  return (
    typeof s == "object" &&
    s !== null &&
    (("name" in s && s.name === "AbortError") ||
      ("message" in s && String(s.message).includes("FetchRequestCanceledException")))
  );
}
var Be = (s) => {
  if (s instanceof Error) return s;
  if (typeof s == "object" && s !== null) {
    try {
      if (Object.prototype.toString.call(s) === "[object Error]") {
        let e = new Error(s.message, s.cause ? { cause: s.cause } : {});
        return (
          s.stack && (e.stack = s.stack),
          s.cause && !e.cause && (e.cause = s.cause),
          s.name && (e.name = s.name),
          e
        );
      }
    } catch {}
    try {
      return new Error(JSON.stringify(s));
    } catch {}
  }
  return new Error(s);
};
var h = class extends Error {},
  k = class s extends h {
    constructor(e, t, r, n) {
      (super(`${s.makeMessage(e, t, r)}`),
        (this.status = e),
        (this.headers = n),
        (this.requestID = n?.get("request-id")),
        (this.error = t));
    }
    static makeMessage(e, t, r) {
      let n = t?.message
        ? typeof t.message == "string"
          ? t.message
          : JSON.stringify(t.message)
        : t
          ? JSON.stringify(t)
          : r;
      return e && n
        ? `${e} ${n}`
        : e
          ? `${e} status code (no body)`
          : n || "(no status code or body)";
    }
    static generate(e, t, r, n) {
      if (!e || !n) return new G({ message: r, cause: Be(t) });
      let i = t;
      return e === 400
        ? new ue(e, i, r, n)
        : e === 401
          ? new he(e, i, r, n)
          : e === 403
            ? new de(e, i, r, n)
            : e === 404
              ? new fe(e, i, r, n)
              : e === 409
                ? new pe(e, i, r, n)
                : e === 422
                  ? new me(e, i, r, n)
                  : e === 429
                    ? new ge(e, i, r, n)
                    : e >= 500
                      ? new be(e, i, r, n)
                      : new s(e, i, r, n);
    }
  },
  v = class extends k {
    constructor({ message: e } = {}) {
      super(void 0, void 0, e || "Request was aborted.", void 0);
    }
  },
  G = class extends k {
    constructor({ message: e, cause: t }) {
      (super(void 0, void 0, e || "Connection error.", void 0), t && (this.cause = t));
    }
  },
  le = class extends G {
    constructor({ message: e } = {}) {
      super({ message: e ?? "Request timed out." });
    }
  },
  ue = class extends k {},
  he = class extends k {},
  de = class extends k {},
  fe = class extends k {},
  pe = class extends k {},
  me = class extends k {},
  ge = class extends k {},
  be = class extends k {};
var Cs = /^[a-z][a-z0-9+.-]*:/i,
  Er = (s) => Cs.test(s),
  Nt = (s) => ((Nt = Array.isArray), Nt(s)),
  $t = Nt;
function nt(s) {
  return typeof s != "object" ? {} : (s ?? {});
}
function Br(s) {
  if (!s) return !0;
  for (let e in s) return !1;
  return !0;
}
function Ir(s, e) {
  return Object.prototype.hasOwnProperty.call(s, e);
}
var Cr = (s, e) => {
  if (typeof e != "number" || !Number.isInteger(e)) throw new h(`${s} must be an integer`);
  if (e < 0) throw new h(`${s} must be a positive integer`);
  return e;
};
var it = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return;
  }
};
var Or = (s) => new Promise((e) => setTimeout(e, s));
var V = "0.73.0";
var Dr = () => typeof window < "u" && typeof window.document < "u" && typeof navigator < "u";
function Os() {
  return typeof Deno < "u" && Deno.build != null
    ? "deno"
    : typeof EdgeRuntime < "u"
      ? "edge"
      : Object.prototype.toString.call(typeof globalThis.process < "u" ? globalThis.process : 0) ===
          "[object process]"
        ? "node"
        : "unknown";
}
var Fs = () => {
  let s = Os();
  if (s === "deno")
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": V,
      "X-Stainless-OS": Nr(Deno.build.os),
      "X-Stainless-Arch": Fr(Deno.build.arch),
      "X-Stainless-Runtime": "deno",
      "X-Stainless-Runtime-Version":
        typeof Deno.version == "string" ? Deno.version : (Deno.version?.deno ?? "unknown"),
    };
  if (typeof EdgeRuntime < "u")
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": V,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": `other:${EdgeRuntime}`,
      "X-Stainless-Runtime": "edge",
      "X-Stainless-Runtime-Version": globalThis.process.version,
    };
  if (s === "node")
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": V,
      "X-Stainless-OS": Nr(globalThis.process.platform ?? "unknown"),
      "X-Stainless-Arch": Fr(globalThis.process.arch ?? "unknown"),
      "X-Stainless-Runtime": "node",
      "X-Stainless-Runtime-Version": globalThis.process.version ?? "unknown",
    };
  let e = Ns();
  return e
    ? {
        "X-Stainless-Lang": "js",
        "X-Stainless-Package-Version": V,
        "X-Stainless-OS": "Unknown",
        "X-Stainless-Arch": "unknown",
        "X-Stainless-Runtime": `browser:${e.browser}`,
        "X-Stainless-Runtime-Version": e.version,
      }
    : {
        "X-Stainless-Lang": "js",
        "X-Stainless-Package-Version": V,
        "X-Stainless-OS": "Unknown",
        "X-Stainless-Arch": "unknown",
        "X-Stainless-Runtime": "unknown",
        "X-Stainless-Runtime-Version": "unknown",
      };
};
function Ns() {
  if (typeof navigator > "u" || !navigator) return null;
  let s = [
    { key: "edge", pattern: /Edge(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /MSIE(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /Trident(?:.*rv\:(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "chrome", pattern: /Chrome(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "firefox", pattern: /Firefox(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "safari", pattern: /(?:Version\W+(\d+)\.(\d+)(?:\.(\d+))?)?(?:\W+Mobile\S*)?\W+Safari/ },
  ];
  for (let { key: e, pattern: t } of s) {
    let r = t.exec(navigator.userAgent);
    if (r) {
      let n = r[1] || 0,
        i = r[2] || 0,
        a = r[3] || 0;
      return { browser: e, version: `${n}.${i}.${a}` };
    }
  }
  return null;
}
var Fr = (s) =>
    s === "x32"
      ? "x32"
      : s === "x86_64" || s === "x64"
        ? "x64"
        : s === "arm"
          ? "arm"
          : s === "aarch64" || s === "arm64"
            ? "arm64"
            : s
              ? `other:${s}`
              : "unknown",
  Nr = (s) => (
    (s = s.toLowerCase()),
    s.includes("ios")
      ? "iOS"
      : s === "android"
        ? "Android"
        : s === "darwin"
          ? "MacOS"
          : s === "win32"
            ? "Windows"
            : s === "freebsd"
              ? "FreeBSD"
              : s === "openbsd"
                ? "OpenBSD"
                : s === "linux"
                  ? "Linux"
                  : s
                    ? `Other:${s}`
                    : "Unknown"
  ),
  $r,
  Lr = () => $r ?? ($r = Fs());
function jr() {
  if (typeof fetch < "u") return fetch;
  throw new Error(
    "`fetch` is not defined as a global; Either pass `fetch` to the client, `new Anthropic({ fetch })` or polyfill the global, `globalThis.fetch = fetch`",
  );
}
function Dt(...s) {
  let e = globalThis.ReadableStream;
  if (typeof e > "u")
    throw new Error(
      "`ReadableStream` is not defined as a global; You will need to polyfill it, `globalThis.ReadableStream = ReadableStream`",
    );
  return new e(...s);
}
function ot(s) {
  let e = Symbol.asyncIterator in s ? s[Symbol.asyncIterator]() : s[Symbol.iterator]();
  return Dt({
    start() {},
    async pull(t) {
      let { done: r, value: n } = await e.next();
      r ? t.close() : t.enqueue(n);
    },
    async cancel() {
      await e.return?.();
    },
  });
}
function Ie(s) {
  if (s[Symbol.asyncIterator]) return s;
  let e = s.getReader();
  return {
    async next() {
      try {
        let t = await e.read();
        return (t?.done && e.releaseLock(), t);
      } catch (t) {
        throw (e.releaseLock(), t);
      }
    },
    async return() {
      let t = e.cancel();
      return (e.releaseLock(), await t, { done: !0, value: void 0 });
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
async function Ur(s) {
  if (s === null || typeof s != "object") return;
  if (s[Symbol.asyncIterator]) {
    await s[Symbol.asyncIterator]().return?.();
    return;
  }
  let e = s.getReader(),
    t = e.cancel();
  (e.releaseLock(), await t);
}
var qr = ({ headers: s, body: e }) => ({
  bodyHeaders: { "content-type": "application/json" },
  body: JSON.stringify(e),
});
function Jr(s) {
  let e = 0;
  for (let n of s) e += n.length;
  let t = new Uint8Array(e),
    r = 0;
  for (let n of s) (t.set(n, r), (r += n.length));
  return t;
}
var Hr;
function Ce(s) {
  let e;
  return (Hr ?? ((e = new globalThis.TextEncoder()), (Hr = e.encode.bind(e))))(s);
}
var Wr;
function Lt(s) {
  let e;
  return (Wr ?? ((e = new globalThis.TextDecoder()), (Wr = e.decode.bind(e))))(s);
}
var T,
  A,
  q = class {
    constructor() {
      (T.set(this, void 0),
        A.set(this, void 0),
        u(this, T, new Uint8Array(), "f"),
        u(this, A, null, "f"));
    }
    decode(e) {
      if (e == null) return [];
      let t = e instanceof ArrayBuffer ? new Uint8Array(e) : typeof e == "string" ? Ce(e) : e;
      u(this, T, Jr([o(this, T, "f"), t]), "f");
      let r = [],
        n;
      for (; (n = Ls(o(this, T, "f"), o(this, A, "f"))) != null; ) {
        if (n.carriage && o(this, A, "f") == null) {
          u(this, A, n.index, "f");
          continue;
        }
        if (o(this, A, "f") != null && (n.index !== o(this, A, "f") + 1 || n.carriage)) {
          (r.push(Lt(o(this, T, "f").subarray(0, o(this, A, "f") - 1))),
            u(this, T, o(this, T, "f").subarray(o(this, A, "f")), "f"),
            u(this, A, null, "f"));
          continue;
        }
        let i = o(this, A, "f") !== null ? n.preceding - 1 : n.preceding,
          a = Lt(o(this, T, "f").subarray(0, i));
        (r.push(a), u(this, T, o(this, T, "f").subarray(n.index), "f"), u(this, A, null, "f"));
      }
      return r;
    }
    flush() {
      return o(this, T, "f").length
        ? this.decode(`
`)
        : [];
    }
  };
((T = new WeakMap()), (A = new WeakMap()));
q.NEWLINE_CHARS = new Set([
  `
`,
  "\r",
]);
q.NEWLINE_REGEXP = /\r\n|[\n\r]/g;
function Ls(s, e) {
  for (let n = e ?? 0; n < s.length; n++) {
    if (s[n] === 10) return { preceding: n, index: n + 1, carriage: !1 };
    if (s[n] === 13) return { preceding: n, index: n + 1, carriage: !0 };
  }
  return null;
}
function Kr(s) {
  for (let r = 0; r < s.length - 1; r++) {
    if ((s[r] === 10 && s[r + 1] === 10) || (s[r] === 13 && s[r + 1] === 13)) return r + 2;
    if (s[r] === 13 && s[r + 1] === 10 && r + 3 < s.length && s[r + 2] === 13 && s[r + 3] === 10)
      return r + 4;
  }
  return -1;
}
var ct = { off: 0, error: 200, warn: 300, info: 400, debug: 500 },
  jt = (s, e, t) => {
    if (s) {
      if (Ir(ct, s)) return s;
      P(t).warn(
        `${e} was set to ${JSON.stringify(s)}, expected one of ${JSON.stringify(Object.keys(ct))}`,
      );
    }
  };
function Oe() {}
function at(s, e, t) {
  return !e || ct[s] > ct[t] ? Oe : e[s].bind(e);
}
var js = { error: Oe, warn: Oe, info: Oe, debug: Oe },
  Xr = new WeakMap();
function P(s) {
  let e = s.logger,
    t = s.logLevel ?? "off";
  if (!e) return js;
  let r = Xr.get(e);
  if (r && r[0] === t) return r[1];
  let n = {
    error: at("error", e, t),
    warn: at("warn", e, t),
    info: at("info", e, t),
    debug: at("debug", e, t),
  };
  return (Xr.set(e, [t, n]), n);
}
var H = (s) => (
  s.options && ((s.options = { ...s.options }), delete s.options.headers),
  s.headers &&
    (s.headers = Object.fromEntries(
      (s.headers instanceof Headers ? [...s.headers] : Object.entries(s.headers)).map(([e, t]) => [
        e,
        e.toLowerCase() === "x-api-key" ||
        e.toLowerCase() === "authorization" ||
        e.toLowerCase() === "cookie" ||
        e.toLowerCase() === "set-cookie"
          ? "***"
          : t,
      ]),
    )),
  "retryOfRequestLogID" in s &&
    (s.retryOfRequestLogID && (s.retryOf = s.retryOfRequestLogID), delete s.retryOfRequestLogID),
  s
);
var Fe,
  $ = class s {
    constructor(e, t, r) {
      ((this.iterator = e), Fe.set(this, void 0), (this.controller = t), u(this, Fe, r, "f"));
    }
    static fromSSEResponse(e, t, r) {
      let n = !1,
        i = r ? P(r) : console;
      async function* a() {
        if (n)
          throw new h("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
        n = !0;
        let c = !1;
        try {
          for await (let l of Us(e, t)) {
            if (l.event === "completion")
              try {
                yield JSON.parse(l.data);
              } catch (d) {
                throw (
                  i.error("Could not parse message into JSON:", l.data),
                  i.error("From chunk:", l.raw),
                  d
                );
              }
            if (
              l.event === "message_start" ||
              l.event === "message_delta" ||
              l.event === "message_stop" ||
              l.event === "content_block_start" ||
              l.event === "content_block_delta" ||
              l.event === "content_block_stop"
            )
              try {
                yield JSON.parse(l.data);
              } catch (d) {
                throw (
                  i.error("Could not parse message into JSON:", l.data),
                  i.error("From chunk:", l.raw),
                  d
                );
              }
            if (l.event !== "ping" && l.event === "error")
              throw new k(void 0, it(l.data) ?? l.data, void 0, e.headers);
          }
          c = !0;
        } catch (l) {
          if (U(l)) return;
          throw l;
        } finally {
          c || t.abort();
        }
      }
      return new s(a, t, r);
    }
    static fromReadableStream(e, t, r) {
      let n = !1;
      async function* i() {
        let c = new q(),
          l = Ie(e);
        for await (let d of l) for (let p of c.decode(d)) yield p;
        for (let d of c.flush()) yield d;
      }
      async function* a() {
        if (n)
          throw new h("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
        n = !0;
        let c = !1;
        try {
          for await (let l of i()) c || (l && (yield JSON.parse(l)));
          c = !0;
        } catch (l) {
          if (U(l)) return;
          throw l;
        } finally {
          c || t.abort();
        }
      }
      return new s(a, t, r);
    }
    [((Fe = new WeakMap()), Symbol.asyncIterator)]() {
      return this.iterator();
    }
    tee() {
      let e = [],
        t = [],
        r = this.iterator(),
        n = (i) => ({
          next: () => {
            if (i.length === 0) {
              let a = r.next();
              (e.push(a), t.push(a));
            }
            return i.shift();
          },
        });
      return [
        new s(() => n(e), this.controller, o(this, Fe, "f")),
        new s(() => n(t), this.controller, o(this, Fe, "f")),
      ];
    }
    toReadableStream() {
      let e = this,
        t;
      return Dt({
        async start() {
          t = e[Symbol.asyncIterator]();
        },
        async pull(r) {
          try {
            let { value: n, done: i } = await t.next();
            if (i) return r.close();
            let a = Ce(
              JSON.stringify(n) +
                `
`,
            );
            r.enqueue(a);
          } catch (n) {
            r.error(n);
          }
        },
        async cancel() {
          await t.return?.();
        },
      });
    }
  };
async function* Us(s, e) {
  if (!s.body)
    throw (
      e.abort(),
      typeof globalThis.navigator < "u" && globalThis.navigator.product === "ReactNative"
        ? new h(
            "The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api",
          )
        : new h("Attempted to iterate over a response with no body")
    );
  let t = new Ut(),
    r = new q(),
    n = Ie(s.body);
  for await (let i of qs(n))
    for (let a of r.decode(i)) {
      let c = t.decode(a);
      c && (yield c);
    }
  for (let i of r.flush()) {
    let a = t.decode(i);
    a && (yield a);
  }
}
async function* qs(s) {
  let e = new Uint8Array();
  for await (let t of s) {
    if (t == null) continue;
    let r = t instanceof ArrayBuffer ? new Uint8Array(t) : typeof t == "string" ? Ce(t) : t,
      n = new Uint8Array(e.length + r.length);
    (n.set(e), n.set(r, e.length), (e = n));
    let i;
    for (; (i = Kr(e)) !== -1; ) (yield e.slice(0, i), (e = e.slice(i)));
  }
  e.length > 0 && (yield e);
}
var Ut = class {
  constructor() {
    ((this.event = null), (this.data = []), (this.chunks = []));
  }
  decode(e) {
    if ((e.endsWith("\r") && (e = e.substring(0, e.length - 1)), !e)) {
      if (!this.event && !this.data.length) return null;
      let i = {
        event: this.event,
        data: this.data.join(`
`),
        raw: this.chunks,
      };
      return ((this.event = null), (this.data = []), (this.chunks = []), i);
    }
    if ((this.chunks.push(e), e.startsWith(":"))) return null;
    let [t, r, n] = Hs(e, ":");
    return (
      n.startsWith(" ") && (n = n.substring(1)),
      t === "event" ? (this.event = n) : t === "data" && this.data.push(n),
      null
    );
  }
};
function Hs(s, e) {
  let t = s.indexOf(e);
  return t !== -1 ? [s.substring(0, t), e, s.substring(t + e.length)] : [s, "", ""];
}
async function lt(s, e) {
  let { response: t, requestLogID: r, retryOfRequestLogID: n, startTime: i } = e,
    a = await (async () => {
      if (e.options.stream)
        return (
          P(s).debug("response", t.status, t.url, t.headers, t.body),
          e.options.__streamClass
            ? e.options.__streamClass.fromSSEResponse(t, e.controller)
            : $.fromSSEResponse(t, e.controller)
        );
      if (t.status === 204) return null;
      if (e.options.__binaryResponse) return t;
      let l = t.headers.get("content-type")?.split(";")[0]?.trim();
      if (l?.includes("application/json") || l?.endsWith("+json")) {
        if (t.headers.get("content-length") === "0") return;
        let x = await t.json();
        return qt(x, t);
      }
      return await t.text();
    })();
  return (
    P(s).debug(
      `[${r}] response parsed`,
      H({
        retryOfRequestLogID: n,
        url: t.url,
        status: t.status,
        body: a,
        durationMs: Date.now() - i,
      }),
    ),
    a
  );
}
function qt(s, e) {
  return !s || typeof s != "object" || Array.isArray(s)
    ? s
    : Object.defineProperty(s, "_request_id", {
        value: e.headers.get("request-id"),
        enumerable: !1,
      });
}
var Ne,
  ee = class s extends Promise {
    constructor(e, t, r = lt) {
      (super((n) => {
        n(null);
      }),
        (this.responsePromise = t),
        (this.parseResponse = r),
        Ne.set(this, void 0),
        u(this, Ne, e, "f"));
    }
    _thenUnwrap(e) {
      return new s(o(this, Ne, "f"), this.responsePromise, async (t, r) =>
        qt(e(await this.parseResponse(t, r), r), r.response),
      );
    }
    asResponse() {
      return this.responsePromise.then((e) => e.response);
    }
    async withResponse() {
      let [e, t] = await Promise.all([this.parse(), this.asResponse()]);
      return { data: e, response: t, request_id: t.headers.get("request-id") };
    }
    parse() {
      return (
        this.parsedPromise ||
          (this.parsedPromise = this.responsePromise.then((e) =>
            this.parseResponse(o(this, Ne, "f"), e),
          )),
        this.parsedPromise
      );
    }
    then(e, t) {
      return this.parse().then(e, t);
    }
    catch(e) {
      return this.parse().catch(e);
    }
    finally(e) {
      return this.parse().finally(e);
    }
  };
Ne = new WeakMap();
var ut,
  ht = class {
    constructor(e, t, r, n) {
      (ut.set(this, void 0),
        u(this, ut, e, "f"),
        (this.options = n),
        (this.response = t),
        (this.body = r));
    }
    hasNextPage() {
      return this.getPaginatedItems().length ? this.nextPageRequestOptions() != null : !1;
    }
    async getNextPage() {
      let e = this.nextPageRequestOptions();
      if (!e)
        throw new h(
          "No next page expected; please check `.hasNextPage()` before calling `.getNextPage()`.",
        );
      return await o(this, ut, "f").requestAPIList(this.constructor, e);
    }
    async *iterPages() {
      let e = this;
      for (yield e; e.hasNextPage(); ) ((e = await e.getNextPage()), yield e);
    }
    async *[((ut = new WeakMap()), Symbol.asyncIterator)]() {
      for await (let e of this.iterPages()) for (let t of e.getPaginatedItems()) yield t;
    }
  },
  $e = class extends ee {
    constructor(e, t, r) {
      super(e, t, async (n, i) => new r(n, i.response, await lt(n, i), i.options));
    }
    async *[Symbol.asyncIterator]() {
      let e = await this;
      for await (let t of e) yield t;
    }
  },
  B = class extends ht {
    constructor(e, t, r, n) {
      (super(e, t, r, n),
        (this.data = r.data || []),
        (this.has_more = r.has_more || !1),
        (this.first_id = r.first_id || null),
        (this.last_id = r.last_id || null));
    }
    getPaginatedItems() {
      return this.data ?? [];
    }
    hasNextPage() {
      return this.has_more === !1 ? !1 : super.hasNextPage();
    }
    nextPageRequestOptions() {
      if (this.options.query?.before_id) {
        let t = this.first_id;
        return t ? { ...this.options, query: { ...nt(this.options.query), before_id: t } } : null;
      }
      let e = this.last_id;
      return e ? { ...this.options, query: { ...nt(this.options.query), after_id: e } } : null;
    }
  };
var ye = class extends ht {
  constructor(e, t, r, n) {
    (super(e, t, r, n),
      (this.data = r.data || []),
      (this.has_more = r.has_more || !1),
      (this.next_page = r.next_page || null));
  }
  getPaginatedItems() {
    return this.data ?? [];
  }
  hasNextPage() {
    return this.has_more === !1 ? !1 : super.hasNextPage();
  }
  nextPageRequestOptions() {
    let e = this.next_page;
    return e ? { ...this.options, query: { ...nt(this.options.query), page: e } } : null;
  }
};
var Wt = () => {
  if (typeof File > "u") {
    let { process: s } = globalThis,
      e = typeof s?.versions?.node == "string" && parseInt(s.versions.node.split(".")) < 20;
    throw new Error(
      "`File` is not defined as a global, which is required for file uploads." +
        (e
          ? " Update to Node 20 LTS or newer, or set `globalThis.File` to `import('node:buffer').File`."
          : ""),
    );
  }
};
function te(s, e, t) {
  return (Wt(), new File(s, e ?? "unknown_file", t));
}
function De(s, e) {
  let t =
    (typeof s == "object" &&
      s !== null &&
      (("name" in s && s.name && String(s.name)) ||
        ("url" in s && s.url && String(s.url)) ||
        ("filename" in s && s.filename && String(s.filename)) ||
        ("path" in s && s.path && String(s.path)))) ||
    "";
  return e ? t.split(/[\\/]/).pop() || void 0 : t;
}
var Jt = (s) => s != null && typeof s == "object" && typeof s[Symbol.asyncIterator] == "function";
var we = async (s, e, t = !0) => ({ ...s, body: await Ks(s.body, e, t) }),
  Gr = new WeakMap();
function Js(s) {
  let e = typeof s == "function" ? s : s.fetch,
    t = Gr.get(e);
  if (t) return t;
  let r = (async () => {
    try {
      let n = "Response" in e ? e.Response : (await e("data:,")).constructor,
        i = new FormData();
      return i.toString() !== (await new n(i).text());
    } catch {
      return !0;
    }
  })();
  return (Gr.set(e, r), r);
}
var Ks = async (s, e, t = !0) => {
    if (!(await Js(e)))
      throw new TypeError(
        "The provided fetch function does not support file uploads with the current global FormData class.",
      );
    let r = new FormData();
    return (await Promise.all(Object.entries(s || {}).map(([n, i]) => Ht(r, n, i, t))), r);
  },
  Xs = (s) => s instanceof Blob && "name" in s;
var Ht = async (s, e, t, r) => {
  if (t !== void 0) {
    if (t == null)
      throw new TypeError(
        `Received null for "${e}"; to pass null in FormData, you must use the string 'null'`,
      );
    if (typeof t == "string" || typeof t == "number" || typeof t == "boolean")
      s.append(e, String(t));
    else if (t instanceof Response) {
      let n = {},
        i = t.headers.get("Content-Type");
      (i && (n = { type: i }), s.append(e, te([await t.blob()], De(t, r), n)));
    } else if (Jt(t)) s.append(e, te([await new Response(ot(t)).blob()], De(t, r)));
    else if (Xs(t)) s.append(e, te([t], De(t, r), { type: t.type }));
    else if (Array.isArray(t)) await Promise.all(t.map((n) => Ht(s, e + "[]", n, r)));
    else if (typeof t == "object")
      await Promise.all(Object.entries(t).map(([n, i]) => Ht(s, `${e}[${n}]`, i, r)));
    else
      throw new TypeError(
        `Invalid value given to form, expected a string, number, boolean, object, Array, File or Blob but got ${t} instead`,
      );
  }
};
var Vr = (s) =>
    s != null &&
    typeof s == "object" &&
    typeof s.size == "number" &&
    typeof s.type == "string" &&
    typeof s.text == "function" &&
    typeof s.slice == "function" &&
    typeof s.arrayBuffer == "function",
  Gs = (s) =>
    s != null &&
    typeof s == "object" &&
    typeof s.name == "string" &&
    typeof s.lastModified == "number" &&
    Vr(s),
  Vs = (s) =>
    s != null && typeof s == "object" && typeof s.url == "string" && typeof s.blob == "function";
async function dt(s, e, t) {
  if ((Wt(), (s = await s), e || (e = De(s, !0)), Gs(s)))
    return s instanceof File && e == null && t == null
      ? s
      : te([await s.arrayBuffer()], e ?? s.name, {
          type: s.type,
          lastModified: s.lastModified,
          ...t,
        });
  if (Vs(s)) {
    let n = await s.blob();
    return (e || (e = new URL(s.url).pathname.split(/[\\/]/).pop()), te(await Kt(n), e, t));
  }
  let r = await Kt(s);
  if (!t?.type) {
    let n = r.find((i) => typeof i == "object" && "type" in i && i.type);
    typeof n == "string" && (t = { ...t, type: n });
  }
  return te(r, e, t);
}
async function Kt(s) {
  let e = [];
  if (typeof s == "string" || ArrayBuffer.isView(s) || s instanceof ArrayBuffer) e.push(s);
  else if (Vr(s)) e.push(s instanceof Blob ? s : await s.arrayBuffer());
  else if (Jt(s)) for await (let t of s) e.push(...(await Kt(t)));
  else {
    let t = s?.constructor?.name;
    throw new Error(`Unexpected data type: ${typeof s}${t ? `; constructor: ${t}` : ""}${zs(s)}`);
  }
  return e;
}
function zs(s) {
  return typeof s != "object" || s === null
    ? ""
    : `; props: [${Object.getOwnPropertyNames(s)
        .map((t) => `"${t}"`)
        .join(", ")}]`;
}
var y = class {
  constructor(e) {
    this._client = e;
  }
};
var zr = Symbol.for("brand.privateNullableHeaders");
function* Qs(s) {
  if (!s) return;
  if (zr in s) {
    let { values: r, nulls: n } = s;
    yield* r.entries();
    for (let i of n) yield [i, null];
    return;
  }
  let e = !1,
    t;
  s instanceof Headers
    ? (t = s.entries())
    : $t(s)
      ? (t = s)
      : ((e = !0), (t = Object.entries(s ?? {})));
  for (let r of t) {
    let n = r[0];
    if (typeof n != "string") throw new TypeError("expected header name to be a string");
    let i = $t(r[1]) ? r[1] : [r[1]],
      a = !1;
    for (let c of i) c !== void 0 && (e && !a && ((a = !0), yield [n, null]), yield [n, c]);
  }
}
var f = (s) => {
  let e = new Headers(),
    t = new Set();
  for (let r of s) {
    let n = new Set();
    for (let [i, a] of Qs(r)) {
      let c = i.toLowerCase();
      (n.has(c) || (e.delete(i), n.add(c)),
        a === null ? (e.delete(i), t.add(c)) : (e.append(i, a), t.delete(c)));
    }
  }
  return { [zr]: !0, values: e, nulls: t };
};
var Le = Symbol("anthropic.sdk.stainlessHelper");
function ft(s) {
  return typeof s == "object" && s !== null && Le in s;
}
function Xt(s, e) {
  let t = new Set();
  if (s) for (let r of s) ft(r) && t.add(r[Le]);
  if (e) {
    for (let r of e)
      if ((ft(r) && t.add(r[Le]), Array.isArray(r.content)))
        for (let n of r.content) ft(n) && t.add(n[Le]);
  }
  return Array.from(t);
}
function pt(s, e) {
  let t = Xt(s, e);
  return t.length === 0 ? {} : { "x-stainless-helper": t.join(", ") };
}
function Yr(s) {
  return ft(s) ? { "x-stainless-helper": s[Le] } : {};
}
function Zr(s) {
  return s.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@]+/g, encodeURIComponent);
}
var Qr = Object.freeze(Object.create(null)),
  Zs = (s = Zr) =>
    function (t, ...r) {
      if (t.length === 1) return t[0];
      let n = !1,
        i = [],
        a = t.reduce((p, b, x) => {
          /[?#]/.test(b) && (n = !0);
          let m = r[x],
            g = (n ? encodeURIComponent : s)("" + m);
          return (
            x !== r.length &&
              (m == null ||
                (typeof m == "object" &&
                  m.toString ===
                    Object.getPrototypeOf(Object.getPrototypeOf(m.hasOwnProperty ?? Qr) ?? Qr)
                      ?.toString)) &&
              ((g = m + ""),
              i.push({
                start: p.length + b.length,
                length: g.length,
                error: `Value of type ${Object.prototype.toString.call(m).slice(8, -1)} is not a valid path parameter`,
              })),
            p + b + (x === r.length ? "" : g)
          );
        }, ""),
        c = a.split(/[?#]/, 1)[0],
        l = /(?<=^|\/)(?:\.|%2e){1,2}(?=\/|$)/gi,
        d;
      for (; (d = l.exec(c)) !== null; )
        i.push({
          start: d.index,
          length: d[0].length,
          error: `Value "${d[0]}" can't be safely passed as a path parameter`,
        });
      if ((i.sort((p, b) => p.start - b.start), i.length > 0)) {
        let p = 0,
          b = i.reduce((x, m) => {
            let g = " ".repeat(m.start - p),
              M = "^".repeat(m.length);
            return ((p = m.start + m.length), x + g + M);
          }, "");
        throw new h(`Path parameters result in path with invalid segments:
${i.map((x) => x.error).join(`
`)}
${a}
${b}`);
      }
      return a;
    },
  w = Zs(Zr);
var _e = class extends y {
  list(e = {}, t) {
    let { betas: r, ...n } = e ?? {};
    return this._client.getAPIList("/v1/files", B, {
      query: n,
      ...t,
      headers: f([
        { "anthropic-beta": [...(r ?? []), "files-api-2025-04-14"].toString() },
        t?.headers,
      ]),
    });
  }
  delete(e, t = {}, r) {
    let { betas: n } = t ?? {};
    return this._client.delete(w`/v1/files/${e}`, {
      ...r,
      headers: f([
        { "anthropic-beta": [...(n ?? []), "files-api-2025-04-14"].toString() },
        r?.headers,
      ]),
    });
  }
  download(e, t = {}, r) {
    let { betas: n } = t ?? {};
    return this._client.get(w`/v1/files/${e}/content`, {
      ...r,
      headers: f([
        {
          "anthropic-beta": [...(n ?? []), "files-api-2025-04-14"].toString(),
          Accept: "application/binary",
        },
        r?.headers,
      ]),
      __binaryResponse: !0,
    });
  }
  retrieveMetadata(e, t = {}, r) {
    let { betas: n } = t ?? {};
    return this._client.get(w`/v1/files/${e}`, {
      ...r,
      headers: f([
        { "anthropic-beta": [...(n ?? []), "files-api-2025-04-14"].toString() },
        r?.headers,
      ]),
    });
  }
  upload(e, t) {
    let { betas: r, ...n } = e;
    return this._client.post(
      "/v1/files",
      we(
        {
          body: n,
          ...t,
          headers: f([
            { "anthropic-beta": [...(r ?? []), "files-api-2025-04-14"].toString() },
            Yr(n.file),
            t?.headers,
          ]),
        },
        this._client,
      ),
    );
  }
};
var Se = class extends y {
  retrieve(e, t = {}, r) {
    let { betas: n } = t ?? {};
    return this._client.get(w`/v1/models/${e}?beta=true`, {
      ...r,
      headers: f([
        { ...(n?.toString() != null ? { "anthropic-beta": n?.toString() } : void 0) },
        r?.headers,
      ]),
    });
  }
  list(e = {}, t) {
    let { betas: r, ...n } = e ?? {};
    return this._client.getAPIList("/v1/models?beta=true", B, {
      query: n,
      ...t,
      headers: f([
        { ...(r?.toString() != null ? { "anthropic-beta": r?.toString() } : void 0) },
        t?.headers,
      ]),
    });
  }
};
var mt = {
  "claude-opus-4-20250514": 8192,
  "claude-opus-4-0": 8192,
  "claude-4-opus-20250514": 8192,
  "anthropic.claude-opus-4-20250514-v1:0": 8192,
  "claude-opus-4@20250514": 8192,
  "claude-opus-4-1-20250805": 8192,
  "anthropic.claude-opus-4-1-20250805-v1:0": 8192,
  "claude-opus-4-1@20250805": 8192,
};
function es(s) {
  return s?.output_format ?? s?.output_config?.format;
}
function Gt(s, e, t) {
  let r = es(e);
  return !e || !("parse" in (r ?? {}))
    ? {
        ...s,
        content: s.content.map((n) => {
          if (n.type === "text") {
            let i = Object.defineProperty({ ...n }, "parsed_output", {
              value: null,
              enumerable: !1,
            });
            return Object.defineProperty(i, "parsed", {
              get() {
                return (
                  t.logger.warn(
                    "The `parsed` property on `text` blocks is deprecated, please use `parsed_output` instead.",
                  ),
                  null
                );
              },
              enumerable: !1,
            });
          }
          return n;
        }),
        parsed_output: null,
      }
    : Vt(s, e, t);
}
function Vt(s, e, t) {
  let r = null,
    n = s.content.map((i) => {
      if (i.type === "text") {
        let a = rn(e, i.text);
        r === null && (r = a);
        let c = Object.defineProperty({ ...i }, "parsed_output", { value: a, enumerable: !1 });
        return Object.defineProperty(c, "parsed", {
          get() {
            return (
              t.logger.warn(
                "The `parsed` property on `text` blocks is deprecated, please use `parsed_output` instead.",
              ),
              a
            );
          },
          enumerable: !1,
        });
      }
      return i;
    });
  return { ...s, content: n, parsed_output: r };
}
function rn(s, e) {
  let t = es(s);
  if (t?.type !== "json_schema") return null;
  try {
    return "parse" in t ? t.parse(e) : JSON.parse(e);
  } catch (r) {
    throw new h(`Failed to parse structured output: ${r}`);
  }
}
var sn = (s) => {
    let e = 0,
      t = [];
    for (; e < s.length; ) {
      let r = s[e];
      if (r === "\\") {
        e++;
        continue;
      }
      if (r === "{") {
        (t.push({ type: "brace", value: "{" }), e++);
        continue;
      }
      if (r === "}") {
        (t.push({ type: "brace", value: "}" }), e++);
        continue;
      }
      if (r === "[") {
        (t.push({ type: "paren", value: "[" }), e++);
        continue;
      }
      if (r === "]") {
        (t.push({ type: "paren", value: "]" }), e++);
        continue;
      }
      if (r === ":") {
        (t.push({ type: "separator", value: ":" }), e++);
        continue;
      }
      if (r === ",") {
        (t.push({ type: "delimiter", value: "," }), e++);
        continue;
      }
      if (r === '"') {
        let c = "",
          l = !1;
        for (r = s[++e]; r !== '"'; ) {
          if (e === s.length) {
            l = !0;
            break;
          }
          if (r === "\\") {
            if ((e++, e === s.length)) {
              l = !0;
              break;
            }
            ((c += r + s[e]), (r = s[++e]));
          } else ((c += r), (r = s[++e]));
        }
        ((r = s[++e]), l || t.push({ type: "string", value: c }));
        continue;
      }
      if (r && /\s/.test(r)) {
        e++;
        continue;
      }
      let i = /[0-9]/;
      if ((r && i.test(r)) || r === "-" || r === ".") {
        let c = "";
        for (r === "-" && ((c += r), (r = s[++e])); (r && i.test(r)) || r === "."; )
          ((c += r), (r = s[++e]));
        t.push({ type: "number", value: c });
        continue;
      }
      let a = /[a-z]/i;
      if (r && a.test(r)) {
        let c = "";
        for (; r && a.test(r) && e !== s.length; ) ((c += r), (r = s[++e]));
        if (c == "true" || c == "false" || c === "null") t.push({ type: "name", value: c });
        else {
          e++;
          continue;
        }
        continue;
      }
      e++;
    }
    return t;
  },
  xe = (s) => {
    if (s.length === 0) return s;
    let e = s[s.length - 1];
    switch (e.type) {
      case "separator":
        return ((s = s.slice(0, s.length - 1)), xe(s));
        break;
      case "number":
        let t = e.value[e.value.length - 1];
        if (t === "." || t === "-") return ((s = s.slice(0, s.length - 1)), xe(s));
      case "string":
        let r = s[s.length - 2];
        if (r?.type === "delimiter") return ((s = s.slice(0, s.length - 1)), xe(s));
        if (r?.type === "brace" && r.value === "{") return ((s = s.slice(0, s.length - 1)), xe(s));
        break;
      case "delimiter":
        return ((s = s.slice(0, s.length - 1)), xe(s));
        break;
    }
    return s;
  },
  nn = (s) => {
    let e = [];
    return (
      s.map((t) => {
        (t.type === "brace" && (t.value === "{" ? e.push("}") : e.splice(e.lastIndexOf("}"), 1)),
          t.type === "paren" && (t.value === "[" ? e.push("]") : e.splice(e.lastIndexOf("]"), 1)));
      }),
      e.length > 0 &&
        e.reverse().map((t) => {
          t === "}"
            ? s.push({ type: "brace", value: "}" })
            : t === "]" && s.push({ type: "paren", value: "]" });
        }),
      s
    );
  },
  on = (s) => {
    let e = "";
    return (
      s.map((t) => {
        t.type === "string" ? (e += '"' + t.value + '"') : (e += t.value);
      }),
      e
    );
  },
  gt = (s) => JSON.parse(on(nn(xe(sn(s)))));
var I,
  z,
  ke,
  je,
  bt,
  Ue,
  qe,
  yt,
  He,
  W,
  We,
  wt,
  _t,
  re,
  St,
  xt,
  Je,
  zt,
  ts,
  kt,
  Yt,
  Qt,
  Zt,
  rs,
  ss = "__json_buf";
function ns(s) {
  return s.type === "tool_use" || s.type === "server_tool_use" || s.type === "mcp_tool_use";
}
var Pt = class s {
  constructor(e, t) {
    (I.add(this),
      (this.messages = []),
      (this.receivedMessages = []),
      z.set(this, void 0),
      ke.set(this, null),
      (this.controller = new AbortController()),
      je.set(this, void 0),
      bt.set(this, () => {}),
      Ue.set(this, () => {}),
      qe.set(this, void 0),
      yt.set(this, () => {}),
      He.set(this, () => {}),
      W.set(this, {}),
      We.set(this, !1),
      wt.set(this, !1),
      _t.set(this, !1),
      re.set(this, !1),
      St.set(this, void 0),
      xt.set(this, void 0),
      Je.set(this, void 0),
      kt.set(this, (r) => {
        if ((u(this, wt, !0, "f"), U(r) && (r = new v()), r instanceof v))
          return (u(this, _t, !0, "f"), this._emit("abort", r));
        if (r instanceof h) return this._emit("error", r);
        if (r instanceof Error) {
          let n = new h(r.message);
          return ((n.cause = r), this._emit("error", n));
        }
        return this._emit("error", new h(String(r)));
      }),
      u(
        this,
        je,
        new Promise((r, n) => {
          (u(this, bt, r, "f"), u(this, Ue, n, "f"));
        }),
        "f",
      ),
      u(
        this,
        qe,
        new Promise((r, n) => {
          (u(this, yt, r, "f"), u(this, He, n, "f"));
        }),
        "f",
      ),
      o(this, je, "f").catch(() => {}),
      o(this, qe, "f").catch(() => {}),
      u(this, ke, e, "f"),
      u(this, Je, t?.logger ?? console, "f"));
  }
  get response() {
    return o(this, St, "f");
  }
  get request_id() {
    return o(this, xt, "f");
  }
  async withResponse() {
    u(this, re, !0, "f");
    let e = await o(this, je, "f");
    if (!e) throw new Error("Could not resolve a `Response` object");
    return { data: this, response: e, request_id: e.headers.get("request-id") };
  }
  static fromReadableStream(e) {
    let t = new s(null);
    return (t._run(() => t._fromReadableStream(e)), t);
  }
  static createMessage(e, t, r, { logger: n } = {}) {
    let i = new s(t, { logger: n });
    for (let a of t.messages) i._addMessageParam(a);
    return (
      u(i, ke, { ...t, stream: !0 }, "f"),
      i._run(() =>
        i._createMessage(
          e,
          { ...t, stream: !0 },
          { ...r, headers: { ...r?.headers, "X-Stainless-Helper-Method": "stream" } },
        ),
      ),
      i
    );
  }
  _run(e) {
    e().then(
      () => {
        (this._emitFinal(), this._emit("end"));
      },
      o(this, kt, "f"),
    );
  }
  _addMessageParam(e) {
    this.messages.push(e);
  }
  _addMessage(e, t = !0) {
    (this.receivedMessages.push(e), t && this._emit("message", e));
  }
  async _createMessage(e, t, r) {
    let n = r?.signal,
      i;
    n &&
      (n.aborted && this.controller.abort(),
      (i = this.controller.abort.bind(this.controller)),
      n.addEventListener("abort", i));
    try {
      o(this, I, "m", Yt).call(this);
      let { response: a, data: c } = await e
        .create({ ...t, stream: !0 }, { ...r, signal: this.controller.signal })
        .withResponse();
      this._connected(a);
      for await (let l of c) o(this, I, "m", Qt).call(this, l);
      if (c.controller.signal?.aborted) throw new v();
      o(this, I, "m", Zt).call(this);
    } finally {
      n && i && n.removeEventListener("abort", i);
    }
  }
  _connected(e) {
    this.ended ||
      (u(this, St, e, "f"),
      u(this, xt, e?.headers.get("request-id"), "f"),
      o(this, bt, "f").call(this, e),
      this._emit("connect"));
  }
  get ended() {
    return o(this, We, "f");
  }
  get errored() {
    return o(this, wt, "f");
  }
  get aborted() {
    return o(this, _t, "f");
  }
  abort() {
    this.controller.abort();
  }
  on(e, t) {
    return ((o(this, W, "f")[e] || (o(this, W, "f")[e] = [])).push({ listener: t }), this);
  }
  off(e, t) {
    let r = o(this, W, "f")[e];
    if (!r) return this;
    let n = r.findIndex((i) => i.listener === t);
    return (n >= 0 && r.splice(n, 1), this);
  }
  once(e, t) {
    return (
      (o(this, W, "f")[e] || (o(this, W, "f")[e] = [])).push({ listener: t, once: !0 }), this
    );
  }
  emitted(e) {
    return new Promise((t, r) => {
      (u(this, re, !0, "f"), e !== "error" && this.once("error", r), this.once(e, t));
    });
  }
  async done() {
    (u(this, re, !0, "f"), await o(this, qe, "f"));
  }
  get currentMessage() {
    return o(this, z, "f");
  }
  async finalMessage() {
    return (await this.done(), o(this, I, "m", zt).call(this));
  }
  async finalText() {
    return (await this.done(), o(this, I, "m", ts).call(this));
  }
  _emit(e, ...t) {
    if (o(this, We, "f")) return;
    e === "end" && (u(this, We, !0, "f"), o(this, yt, "f").call(this));
    let r = o(this, W, "f")[e];
    if (
      (r &&
        ((o(this, W, "f")[e] = r.filter((n) => !n.once)), r.forEach(({ listener: n }) => n(...t))),
      e === "abort")
    ) {
      let n = t[0];
      (!o(this, re, "f") && !r?.length && Promise.reject(n),
        o(this, Ue, "f").call(this, n),
        o(this, He, "f").call(this, n),
        this._emit("end"));
      return;
    }
    if (e === "error") {
      let n = t[0];
      (!o(this, re, "f") && !r?.length && Promise.reject(n),
        o(this, Ue, "f").call(this, n),
        o(this, He, "f").call(this, n),
        this._emit("end"));
    }
  }
  _emitFinal() {
    this.receivedMessages.at(-1) && this._emit("finalMessage", o(this, I, "m", zt).call(this));
  }
  async _fromReadableStream(e, t) {
    let r = t?.signal,
      n;
    r &&
      (r.aborted && this.controller.abort(),
      (n = this.controller.abort.bind(this.controller)),
      r.addEventListener("abort", n));
    try {
      (o(this, I, "m", Yt).call(this), this._connected(null));
      let i = $.fromReadableStream(e, this.controller);
      for await (let a of i) o(this, I, "m", Qt).call(this, a);
      if (i.controller.signal?.aborted) throw new v();
      o(this, I, "m", Zt).call(this);
    } finally {
      r && n && r.removeEventListener("abort", n);
    }
  }
  [((z = new WeakMap()),
  (ke = new WeakMap()),
  (je = new WeakMap()),
  (bt = new WeakMap()),
  (Ue = new WeakMap()),
  (qe = new WeakMap()),
  (yt = new WeakMap()),
  (He = new WeakMap()),
  (W = new WeakMap()),
  (We = new WeakMap()),
  (wt = new WeakMap()),
  (_t = new WeakMap()),
  (re = new WeakMap()),
  (St = new WeakMap()),
  (xt = new WeakMap()),
  (Je = new WeakMap()),
  (kt = new WeakMap()),
  (I = new WeakSet()),
  (zt = function () {
    if (this.receivedMessages.length === 0)
      throw new h("stream ended without producing a Message with role=assistant");
    return this.receivedMessages.at(-1);
  }),
  (ts = function () {
    if (this.receivedMessages.length === 0)
      throw new h("stream ended without producing a Message with role=assistant");
    let t = this.receivedMessages
      .at(-1)
      .content.filter((r) => r.type === "text")
      .map((r) => r.text);
    if (t.length === 0)
      throw new h("stream ended without producing a content block with type=text");
    return t.join(" ");
  }),
  (Yt = function () {
    this.ended || u(this, z, void 0, "f");
  }),
  (Qt = function (t) {
    if (this.ended) return;
    let r = o(this, I, "m", rs).call(this, t);
    switch ((this._emit("streamEvent", t, r), t.type)) {
      case "content_block_delta": {
        let n = r.content.at(-1);
        switch (t.delta.type) {
          case "text_delta": {
            n.type === "text" && this._emit("text", t.delta.text, n.text || "");
            break;
          }
          case "citations_delta": {
            n.type === "text" && this._emit("citation", t.delta.citation, n.citations ?? []);
            break;
          }
          case "input_json_delta": {
            ns(n) && n.input && this._emit("inputJson", t.delta.partial_json, n.input);
            break;
          }
          case "thinking_delta": {
            n.type === "thinking" && this._emit("thinking", t.delta.thinking, n.thinking);
            break;
          }
          case "signature_delta": {
            n.type === "thinking" && this._emit("signature", n.signature);
            break;
          }
          case "compaction_delta": {
            n.type === "compaction" && n.content && this._emit("compaction", n.content);
            break;
          }
          default:
            t.delta;
        }
        break;
      }
      case "message_stop": {
        (this._addMessageParam(r),
          this._addMessage(Gt(r, o(this, ke, "f"), { logger: o(this, Je, "f") }), !0));
        break;
      }
      case "content_block_stop": {
        this._emit("contentBlock", r.content.at(-1));
        break;
      }
      case "message_start": {
        u(this, z, r, "f");
        break;
      }
      case "content_block_start":
      case "message_delta":
        break;
    }
  }),
  (Zt = function () {
    if (this.ended) throw new h("stream has ended, this shouldn't happen");
    let t = o(this, z, "f");
    if (!t) throw new h("request ended without sending any chunks");
    return (u(this, z, void 0, "f"), Gt(t, o(this, ke, "f"), { logger: o(this, Je, "f") }));
  }),
  (rs = function (t) {
    let r = o(this, z, "f");
    if (t.type === "message_start") {
      if (r) throw new h(`Unexpected event order, got ${t.type} before receiving "message_stop"`);
      return t.message;
    }
    if (!r) throw new h(`Unexpected event order, got ${t.type} before "message_start"`);
    switch (t.type) {
      case "message_stop":
        return r;
      case "message_delta":
        return (
          (r.container = t.delta.container),
          (r.stop_reason = t.delta.stop_reason),
          (r.stop_sequence = t.delta.stop_sequence),
          (r.usage.output_tokens = t.usage.output_tokens),
          (r.context_management = t.context_management),
          t.usage.input_tokens != null && (r.usage.input_tokens = t.usage.input_tokens),
          t.usage.cache_creation_input_tokens != null &&
            (r.usage.cache_creation_input_tokens = t.usage.cache_creation_input_tokens),
          t.usage.cache_read_input_tokens != null &&
            (r.usage.cache_read_input_tokens = t.usage.cache_read_input_tokens),
          t.usage.server_tool_use != null && (r.usage.server_tool_use = t.usage.server_tool_use),
          t.usage.iterations != null && (r.usage.iterations = t.usage.iterations),
          r
        );
      case "content_block_start":
        return (r.content.push(t.content_block), r);
      case "content_block_delta": {
        let n = r.content.at(t.index);
        switch (t.delta.type) {
          case "text_delta": {
            n?.type === "text" &&
              (r.content[t.index] = { ...n, text: (n.text || "") + t.delta.text });
            break;
          }
          case "citations_delta": {
            n?.type === "text" &&
              (r.content[t.index] = {
                ...n,
                citations: [...(n.citations ?? []), t.delta.citation],
              });
            break;
          }
          case "input_json_delta": {
            if (n && ns(n)) {
              let i = n[ss] || "";
              i += t.delta.partial_json;
              let a = { ...n };
              if ((Object.defineProperty(a, ss, { value: i, enumerable: !1, writable: !0 }), i))
                try {
                  a.input = gt(i);
                } catch (c) {
                  let l = new h(
                    `Unable to parse tool parameter JSON from model. Please retry your request or adjust your prompt. Error: ${c}. JSON: ${i}`,
                  );
                  o(this, kt, "f").call(this, l);
                }
              r.content[t.index] = a;
            }
            break;
          }
          case "thinking_delta": {
            n?.type === "thinking" &&
              (r.content[t.index] = { ...n, thinking: n.thinking + t.delta.thinking });
            break;
          }
          case "signature_delta": {
            n?.type === "thinking" && (r.content[t.index] = { ...n, signature: t.delta.signature });
            break;
          }
          case "compaction_delta": {
            n?.type === "compaction" &&
              (r.content[t.index] = { ...n, content: (n.content || "") + t.delta.content });
            break;
          }
          default:
            t.delta;
        }
        return r;
      }
      case "content_block_stop":
        return r;
    }
  }),
  Symbol.asyncIterator)]() {
    let e = [],
      t = [],
      r = !1;
    return (
      this.on("streamEvent", (n) => {
        let i = t.shift();
        i ? i.resolve(n) : e.push(n);
      }),
      this.on("end", () => {
        r = !0;
        for (let n of t) n.resolve(void 0);
        t.length = 0;
      }),
      this.on("abort", (n) => {
        r = !0;
        for (let i of t) i.reject(n);
        t.length = 0;
      }),
      this.on("error", (n) => {
        r = !0;
        for (let i of t) i.reject(n);
        t.length = 0;
      }),
      {
        next: async () =>
          e.length
            ? { value: e.shift(), done: !1 }
            : r
              ? { value: void 0, done: !0 }
              : new Promise((i, a) => t.push({ resolve: i, reject: a })).then((i) =>
                  i ? { value: i, done: !1 } : { value: void 0, done: !0 },
                ),
        return: async () => (this.abort(), { value: void 0, done: !0 }),
      }
    );
  }
  toReadableStream() {
    return new $(this[Symbol.asyncIterator].bind(this), this.controller).toReadableStream();
  }
};
var se = class extends Error {
  constructor(e) {
    let t =
      typeof e == "string"
        ? e
        : e.map((r) => (r.type === "text" ? r.text : `[${r.type}]`)).join(" ");
    (super(t), (this.name = "ToolError"), (this.content = e));
  }
};
var is = `You have been working on the task described above but have not yet completed it. Write a continuation summary that will allow you (or another instance of yourself) to resume work efficiently in a future context window where the conversation history will be replaced with this summary. Your summary should be structured, concise, and actionable. Include:
1. Task Overview
The user's core request and success criteria
Any clarifications or constraints they specified
2. Current State
What has been completed so far
Files created, modified, or analyzed (with paths if relevant)
Key outputs or artifacts produced
3. Important Discoveries
Technical constraints or requirements uncovered
Decisions made and their rationale
Errors encountered and how they were resolved
What approaches were tried that didn't work (and why)
4. Next Steps
Specific actions needed to complete the task
Any blockers or open questions to resolve
Priority order if multiple steps remain
5. Context to Preserve
User preferences or style requirements
Domain-specific details that aren't obvious
Any promises made to the user
Be concise but complete\u2014err on the side of including information that would prevent duplicate work or repeated mistakes. Write in a way that enables immediate resumption of the task.
Wrap your summary in <summary></summary> tags.`;
var Ke, Pe, ne, S, Xe, E, J, Y, Ge, os, er;
function as() {
  let s, e;
  return {
    promise: new Promise((r, n) => {
      ((s = r), (e = n));
    }),
    resolve: s,
    reject: e,
  };
}
var ve = class {
  constructor(e, t, r) {
    (Ke.add(this),
      (this.client = e),
      Pe.set(this, !1),
      ne.set(this, !1),
      S.set(this, void 0),
      Xe.set(this, void 0),
      E.set(this, void 0),
      J.set(this, void 0),
      Y.set(this, void 0),
      Ge.set(this, 0),
      u(this, S, { params: { ...t, messages: structuredClone(t.messages) } }, "f"));
    let i = ["BetaToolRunner", ...Xt(t.tools, t.messages)].join(", ");
    (u(this, Xe, { ...r, headers: f([{ "x-stainless-helper": i }, r?.headers]) }, "f"),
      u(this, Y, as(), "f"));
  }
  async *[((Pe = new WeakMap()),
  (ne = new WeakMap()),
  (S = new WeakMap()),
  (Xe = new WeakMap()),
  (E = new WeakMap()),
  (J = new WeakMap()),
  (Y = new WeakMap()),
  (Ge = new WeakMap()),
  (Ke = new WeakSet()),
  (os = async function () {
    let t = o(this, S, "f").params.compactionControl;
    if (!t || !t.enabled) return !1;
    let r = 0;
    if (o(this, E, "f") !== void 0)
      try {
        let d = await o(this, E, "f");
        r =
          d.usage.input_tokens +
          (d.usage.cache_creation_input_tokens ?? 0) +
          (d.usage.cache_read_input_tokens ?? 0) +
          d.usage.output_tokens;
      } catch {
        return !1;
      }
    let n = t.contextTokenThreshold ?? 1e5;
    if (r < n) return !1;
    let i = t.model ?? o(this, S, "f").params.model,
      a = t.summaryPrompt ?? is,
      c = o(this, S, "f").params.messages;
    if (c[c.length - 1].role === "assistant") {
      let d = c[c.length - 1];
      if (Array.isArray(d.content)) {
        let p = d.content.filter((b) => b.type !== "tool_use");
        p.length === 0 ? c.pop() : (d.content = p);
      }
    }
    let l = await this.client.beta.messages.create(
      {
        model: i,
        messages: [...c, { role: "user", content: [{ type: "text", text: a }] }],
        max_tokens: o(this, S, "f").params.max_tokens,
      },
      { headers: { "x-stainless-helper": "compaction" } },
    );
    if (l.content[0]?.type !== "text") throw new h("Expected text response for compaction");
    return ((o(this, S, "f").params.messages = [{ role: "user", content: l.content }]), !0);
  }),
  Symbol.asyncIterator)]() {
    var e;
    if (o(this, Pe, "f")) throw new h("Cannot iterate over a consumed stream");
    (u(this, Pe, !0, "f"), u(this, ne, !0, "f"), u(this, J, void 0, "f"));
    try {
      for (;;) {
        let t;
        try {
          if (
            o(this, S, "f").params.max_iterations &&
            o(this, Ge, "f") >= o(this, S, "f").params.max_iterations
          )
            break;
          (u(this, ne, !1, "f"),
            u(this, J, void 0, "f"),
            u(this, Ge, ((e = o(this, Ge, "f")), e++, e), "f"),
            u(this, E, void 0, "f"));
          let { max_iterations: r, compactionControl: n, ...i } = o(this, S, "f").params;
          if (
            (i.stream
              ? ((t = this.client.beta.messages.stream({ ...i }, o(this, Xe, "f"))),
                u(this, E, t.finalMessage(), "f"),
                o(this, E, "f").catch(() => {}),
                yield t)
              : (u(
                  this,
                  E,
                  this.client.beta.messages.create({ ...i, stream: !1 }, o(this, Xe, "f")),
                  "f",
                ),
                yield o(this, E, "f")),
            !(await o(this, Ke, "m", os).call(this)))
          ) {
            if (!o(this, ne, "f")) {
              let { role: l, content: d } = await o(this, E, "f");
              o(this, S, "f").params.messages.push({ role: l, content: d });
            }
            let c = await o(this, Ke, "m", er).call(this, o(this, S, "f").params.messages.at(-1));
            if (c) o(this, S, "f").params.messages.push(c);
            else if (!o(this, ne, "f")) break;
          }
        } finally {
          t && t.abort();
        }
      }
      if (!o(this, E, "f")) throw new h("ToolRunner concluded without a message from the server");
      o(this, Y, "f").resolve(await o(this, E, "f"));
    } catch (t) {
      throw (
        u(this, Pe, !1, "f"),
        o(this, Y, "f").promise.catch(() => {}),
        o(this, Y, "f").reject(t),
        u(this, Y, as(), "f"),
        t
      );
    }
  }
  setMessagesParams(e) {
    (typeof e == "function"
      ? (o(this, S, "f").params = e(o(this, S, "f").params))
      : (o(this, S, "f").params = e),
      u(this, ne, !0, "f"),
      u(this, J, void 0, "f"));
  }
  async generateToolResponse() {
    let e = (await o(this, E, "f")) ?? this.params.messages.at(-1);
    return e ? o(this, Ke, "m", er).call(this, e) : null;
  }
  done() {
    return o(this, Y, "f").promise;
  }
  async runUntilDone() {
    if (!o(this, Pe, "f")) for await (let e of this);
    return this.done();
  }
  get params() {
    return o(this, S, "f").params;
  }
  pushMessages(...e) {
    this.setMessagesParams((t) => ({ ...t, messages: [...t.messages, ...e] }));
  }
  then(e, t) {
    return this.runUntilDone().then(e, t);
  }
};
er = async function (e) {
  return o(this, J, "f") !== void 0
    ? o(this, J, "f")
    : (u(this, J, cn(o(this, S, "f").params, e), "f"), o(this, J, "f"));
};
async function cn(s, e = s.messages.at(-1)) {
  if (!e || e.role !== "assistant" || !e.content || typeof e.content == "string") return null;
  let t = e.content.filter((n) => n.type === "tool_use");
  return t.length === 0
    ? null
    : {
        role: "user",
        content: await Promise.all(
          t.map(async (n) => {
            let i = s.tools.find((a) => ("name" in a ? a.name : a.mcp_server_name) === n.name);
            if (!i || !("run" in i))
              return {
                type: "tool_result",
                tool_use_id: n.id,
                content: `Error: Tool '${n.name}' not found`,
                is_error: !0,
              };
            try {
              let a = n.input;
              "parse" in i && i.parse && (a = i.parse(a));
              let c = await i.run(a);
              return { type: "tool_result", tool_use_id: n.id, content: c };
            } catch (a) {
              return {
                type: "tool_result",
                tool_use_id: n.id,
                content:
                  a instanceof se
                    ? a.content
                    : `Error: ${a instanceof Error ? a.message : String(a)}`,
                is_error: !0,
              };
            }
          }),
        ),
      };
}
var Re = class s {
  constructor(e, t) {
    ((this.iterator = e), (this.controller = t));
  }
  async *decoder() {
    let e = new q();
    for await (let t of this.iterator) for (let r of e.decode(t)) yield JSON.parse(r);
    for (let t of e.flush()) yield JSON.parse(t);
  }
  [Symbol.asyncIterator]() {
    return this.decoder();
  }
  static fromResponse(e, t) {
    if (!e.body)
      throw (
        t.abort(),
        typeof globalThis.navigator < "u" && globalThis.navigator.product === "ReactNative"
          ? new h(
              "The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api",
            )
          : new h("Attempted to iterate over a response with no body")
      );
    return new s(Ie(e.body), t);
  }
};
var Me = class extends y {
  create(e, t) {
    let { betas: r, ...n } = e;
    return this._client.post("/v1/messages/batches?beta=true", {
      body: n,
      ...t,
      headers: f([
        { "anthropic-beta": [...(r ?? []), "message-batches-2024-09-24"].toString() },
        t?.headers,
      ]),
    });
  }
  retrieve(e, t = {}, r) {
    let { betas: n } = t ?? {};
    return this._client.get(w`/v1/messages/batches/${e}?beta=true`, {
      ...r,
      headers: f([
        { "anthropic-beta": [...(n ?? []), "message-batches-2024-09-24"].toString() },
        r?.headers,
      ]),
    });
  }
  list(e = {}, t) {
    let { betas: r, ...n } = e ?? {};
    return this._client.getAPIList("/v1/messages/batches?beta=true", B, {
      query: n,
      ...t,
      headers: f([
        { "anthropic-beta": [...(r ?? []), "message-batches-2024-09-24"].toString() },
        t?.headers,
      ]),
    });
  }
  delete(e, t = {}, r) {
    let { betas: n } = t ?? {};
    return this._client.delete(w`/v1/messages/batches/${e}?beta=true`, {
      ...r,
      headers: f([
        { "anthropic-beta": [...(n ?? []), "message-batches-2024-09-24"].toString() },
        r?.headers,
      ]),
    });
  }
  cancel(e, t = {}, r) {
    let { betas: n } = t ?? {};
    return this._client.post(w`/v1/messages/batches/${e}/cancel?beta=true`, {
      ...r,
      headers: f([
        { "anthropic-beta": [...(n ?? []), "message-batches-2024-09-24"].toString() },
        r?.headers,
      ]),
    });
  }
  async results(e, t = {}, r) {
    let n = await this.retrieve(e);
    if (!n.results_url)
      throw new h(
        `No batch \`results_url\`; Has it finished processing? ${n.processing_status} - ${n.id}`,
      );
    let { betas: i } = t ?? {};
    return this._client
      .get(n.results_url, {
        ...r,
        headers: f([
          {
            "anthropic-beta": [...(i ?? []), "message-batches-2024-09-24"].toString(),
            Accept: "application/binary",
          },
          r?.headers,
        ]),
        stream: !0,
        __binaryResponse: !0,
      })
      ._thenUnwrap((a, c) => Re.fromResponse(c.response, c.controller));
  }
};
var cs = {
    "claude-1.3": "November 6th, 2024",
    "claude-1.3-100k": "November 6th, 2024",
    "claude-instant-1.1": "November 6th, 2024",
    "claude-instant-1.1-100k": "November 6th, 2024",
    "claude-instant-1.2": "November 6th, 2024",
    "claude-3-sonnet-20240229": "July 21st, 2025",
    "claude-3-opus-20240229": "January 5th, 2026",
    "claude-2.1": "July 21st, 2025",
    "claude-2.0": "July 21st, 2025",
    "claude-3-7-sonnet-latest": "February 19th, 2026",
    "claude-3-7-sonnet-20250219": "February 19th, 2026",
  },
  un = ["claude-opus-4-6"],
  K = class extends y {
    constructor() {
      (super(...arguments), (this.batches = new Me(this._client)));
    }
    create(e, t) {
      let r = ls(e),
        { betas: n, ...i } = r;
      (i.model in cs &&
        console.warn(`The model '${i.model}' is deprecated and will reach end-of-life on ${cs[i.model]}
Please migrate to a newer model. Visit https://docs.anthropic.com/en/docs/resources/model-deprecations for more information.`),
        i.model in un &&
          i.thinking &&
          i.thinking.type === "enabled" &&
          console.warn(
            `Using Claude with ${i.model} and 'thinking.type=enabled' is deprecated. Use 'thinking.type=adaptive' instead which results in better model performance in our testing: https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking`,
          ));
      let a = this._client._options.timeout;
      if (!i.stream && a == null) {
        let l = mt[i.model] ?? void 0;
        a = this._client.calculateNonstreamingTimeout(i.max_tokens, l);
      }
      let c = pt(i.tools, i.messages);
      return this._client.post("/v1/messages?beta=true", {
        body: i,
        timeout: a ?? 6e5,
        ...t,
        headers: f([
          { ...(n?.toString() != null ? { "anthropic-beta": n?.toString() } : void 0) },
          c,
          t?.headers,
        ]),
        stream: r.stream ?? !1,
      });
    }
    parse(e, t) {
      return (
        (t = {
          ...t,
          headers: f([
            { "anthropic-beta": [...(e.betas ?? []), "structured-outputs-2025-12-15"].toString() },
            t?.headers,
          ]),
        }),
        this.create(e, t).then((r) => Vt(r, e, { logger: this._client.logger ?? console }))
      );
    }
    stream(e, t) {
      return Pt.createMessage(this, e, t);
    }
    countTokens(e, t) {
      let r = ls(e),
        { betas: n, ...i } = r;
      return this._client.post("/v1/messages/count_tokens?beta=true", {
        body: i,
        ...t,
        headers: f([
          { "anthropic-beta": [...(n ?? []), "token-counting-2024-11-01"].toString() },
          t?.headers,
        ]),
      });
    }
    toolRunner(e, t) {
      return new ve(this._client, e, t);
    }
  };
function ls(s) {
  if (!s.output_format) return s;
  if (s.output_config?.format)
    throw new h(
      "Both output_format and output_config.format were provided. Please use only output_config.format (output_format is deprecated).",
    );
  let { output_format: e, ...t } = s;
  return { ...t, output_config: { ...s.output_config, format: e } };
}
K.Batches = Me;
K.BetaToolRunner = ve;
K.ToolError = se;
var Te = class extends y {
  create(e, t = {}, r) {
    let { betas: n, ...i } = t ?? {};
    return this._client.post(
      w`/v1/skills/${e}/versions?beta=true`,
      we(
        {
          body: i,
          ...r,
          headers: f([
            { "anthropic-beta": [...(n ?? []), "skills-2025-10-02"].toString() },
            r?.headers,
          ]),
        },
        this._client,
      ),
    );
  }
  retrieve(e, t, r) {
    let { skill_id: n, betas: i } = t;
    return this._client.get(w`/v1/skills/${n}/versions/${e}?beta=true`, {
      ...r,
      headers: f([
        { "anthropic-beta": [...(i ?? []), "skills-2025-10-02"].toString() },
        r?.headers,
      ]),
    });
  }
  list(e, t = {}, r) {
    let { betas: n, ...i } = t ?? {};
    return this._client.getAPIList(w`/v1/skills/${e}/versions?beta=true`, ye, {
      query: i,
      ...r,
      headers: f([
        { "anthropic-beta": [...(n ?? []), "skills-2025-10-02"].toString() },
        r?.headers,
      ]),
    });
  }
  delete(e, t, r) {
    let { skill_id: n, betas: i } = t;
    return this._client.delete(w`/v1/skills/${n}/versions/${e}?beta=true`, {
      ...r,
      headers: f([
        { "anthropic-beta": [...(i ?? []), "skills-2025-10-02"].toString() },
        r?.headers,
      ]),
    });
  }
};
var ie = class extends y {
  constructor() {
    (super(...arguments), (this.versions = new Te(this._client)));
  }
  create(e = {}, t) {
    let { betas: r, ...n } = e ?? {};
    return this._client.post(
      "/v1/skills?beta=true",
      we(
        {
          body: n,
          ...t,
          headers: f([
            { "anthropic-beta": [...(r ?? []), "skills-2025-10-02"].toString() },
            t?.headers,
          ]),
        },
        this._client,
        !1,
      ),
    );
  }
  retrieve(e, t = {}, r) {
    let { betas: n } = t ?? {};
    return this._client.get(w`/v1/skills/${e}?beta=true`, {
      ...r,
      headers: f([
        { "anthropic-beta": [...(n ?? []), "skills-2025-10-02"].toString() },
        r?.headers,
      ]),
    });
  }
  list(e = {}, t) {
    let { betas: r, ...n } = e ?? {};
    return this._client.getAPIList("/v1/skills?beta=true", ye, {
      query: n,
      ...t,
      headers: f([
        { "anthropic-beta": [...(r ?? []), "skills-2025-10-02"].toString() },
        t?.headers,
      ]),
    });
  }
  delete(e, t = {}, r) {
    let { betas: n } = t ?? {};
    return this._client.delete(w`/v1/skills/${e}?beta=true`, {
      ...r,
      headers: f([
        { "anthropic-beta": [...(n ?? []), "skills-2025-10-02"].toString() },
        r?.headers,
      ]),
    });
  }
};
ie.Versions = Te;
var F = class extends y {
  constructor() {
    (super(...arguments),
      (this.models = new Se(this._client)),
      (this.messages = new K(this._client)),
      (this.files = new _e(this._client)),
      (this.skills = new ie(this._client)));
  }
};
F.Models = Se;
F.Messages = K;
F.Files = _e;
F.Skills = ie;
var oe = class extends y {
  create(e, t) {
    let { betas: r, ...n } = e;
    return this._client.post("/v1/complete", {
      body: n,
      timeout: this._client._options.timeout ?? 6e5,
      ...t,
      headers: f([
        { ...(r?.toString() != null ? { "anthropic-beta": r?.toString() } : void 0) },
        t?.headers,
      ]),
      stream: e.stream ?? !1,
    });
  }
};
function us(s) {
  return s?.output_config?.format;
}
function tr(s, e, t) {
  let r = us(e);
  return !e || !("parse" in (r ?? {}))
    ? {
        ...s,
        content: s.content.map((n) =>
          n.type === "text"
            ? Object.defineProperty({ ...n }, "parsed_output", { value: null, enumerable: !1 })
            : n,
        ),
        parsed_output: null,
      }
    : rr(s, e, t);
}
function rr(s, e, t) {
  let r = null,
    n = s.content.map((i) => {
      if (i.type === "text") {
        let a = pn(e, i.text);
        return (
          r === null && (r = a),
          Object.defineProperty({ ...i }, "parsed_output", { value: a, enumerable: !1 })
        );
      }
      return i;
    });
  return { ...s, content: n, parsed_output: r };
}
function pn(s, e) {
  let t = us(s);
  if (t?.type !== "json_schema") return null;
  try {
    return "parse" in t ? t.parse(e) : JSON.parse(e);
  } catch (r) {
    throw new h(`Failed to parse structured output: ${r}`);
  }
}
var C,
  Q,
  Ae,
  Ve,
  vt,
  ze,
  Ye,
  Rt,
  Qe,
  X,
  Ze,
  Mt,
  Tt,
  ae,
  At,
  Et,
  et,
  sr,
  hs,
  nr,
  ir,
  or,
  ar,
  ds,
  fs = "__json_buf";
function ps(s) {
  return s.type === "tool_use" || s.type === "server_tool_use";
}
var Bt = class s {
  constructor(e, t) {
    (C.add(this),
      (this.messages = []),
      (this.receivedMessages = []),
      Q.set(this, void 0),
      Ae.set(this, null),
      (this.controller = new AbortController()),
      Ve.set(this, void 0),
      vt.set(this, () => {}),
      ze.set(this, () => {}),
      Ye.set(this, void 0),
      Rt.set(this, () => {}),
      Qe.set(this, () => {}),
      X.set(this, {}),
      Ze.set(this, !1),
      Mt.set(this, !1),
      Tt.set(this, !1),
      ae.set(this, !1),
      At.set(this, void 0),
      Et.set(this, void 0),
      et.set(this, void 0),
      nr.set(this, (r) => {
        if ((u(this, Mt, !0, "f"), U(r) && (r = new v()), r instanceof v))
          return (u(this, Tt, !0, "f"), this._emit("abort", r));
        if (r instanceof h) return this._emit("error", r);
        if (r instanceof Error) {
          let n = new h(r.message);
          return ((n.cause = r), this._emit("error", n));
        }
        return this._emit("error", new h(String(r)));
      }),
      u(
        this,
        Ve,
        new Promise((r, n) => {
          (u(this, vt, r, "f"), u(this, ze, n, "f"));
        }),
        "f",
      ),
      u(
        this,
        Ye,
        new Promise((r, n) => {
          (u(this, Rt, r, "f"), u(this, Qe, n, "f"));
        }),
        "f",
      ),
      o(this, Ve, "f").catch(() => {}),
      o(this, Ye, "f").catch(() => {}),
      u(this, Ae, e, "f"),
      u(this, et, t?.logger ?? console, "f"));
  }
  get response() {
    return o(this, At, "f");
  }
  get request_id() {
    return o(this, Et, "f");
  }
  async withResponse() {
    u(this, ae, !0, "f");
    let e = await o(this, Ve, "f");
    if (!e) throw new Error("Could not resolve a `Response` object");
    return { data: this, response: e, request_id: e.headers.get("request-id") };
  }
  static fromReadableStream(e) {
    let t = new s(null);
    return (t._run(() => t._fromReadableStream(e)), t);
  }
  static createMessage(e, t, r, { logger: n } = {}) {
    let i = new s(t, { logger: n });
    for (let a of t.messages) i._addMessageParam(a);
    return (
      u(i, Ae, { ...t, stream: !0 }, "f"),
      i._run(() =>
        i._createMessage(
          e,
          { ...t, stream: !0 },
          { ...r, headers: { ...r?.headers, "X-Stainless-Helper-Method": "stream" } },
        ),
      ),
      i
    );
  }
  _run(e) {
    e().then(
      () => {
        (this._emitFinal(), this._emit("end"));
      },
      o(this, nr, "f"),
    );
  }
  _addMessageParam(e) {
    this.messages.push(e);
  }
  _addMessage(e, t = !0) {
    (this.receivedMessages.push(e), t && this._emit("message", e));
  }
  async _createMessage(e, t, r) {
    let n = r?.signal,
      i;
    n &&
      (n.aborted && this.controller.abort(),
      (i = this.controller.abort.bind(this.controller)),
      n.addEventListener("abort", i));
    try {
      o(this, C, "m", ir).call(this);
      let { response: a, data: c } = await e
        .create({ ...t, stream: !0 }, { ...r, signal: this.controller.signal })
        .withResponse();
      this._connected(a);
      for await (let l of c) o(this, C, "m", or).call(this, l);
      if (c.controller.signal?.aborted) throw new v();
      o(this, C, "m", ar).call(this);
    } finally {
      n && i && n.removeEventListener("abort", i);
    }
  }
  _connected(e) {
    this.ended ||
      (u(this, At, e, "f"),
      u(this, Et, e?.headers.get("request-id"), "f"),
      o(this, vt, "f").call(this, e),
      this._emit("connect"));
  }
  get ended() {
    return o(this, Ze, "f");
  }
  get errored() {
    return o(this, Mt, "f");
  }
  get aborted() {
    return o(this, Tt, "f");
  }
  abort() {
    this.controller.abort();
  }
  on(e, t) {
    return ((o(this, X, "f")[e] || (o(this, X, "f")[e] = [])).push({ listener: t }), this);
  }
  off(e, t) {
    let r = o(this, X, "f")[e];
    if (!r) return this;
    let n = r.findIndex((i) => i.listener === t);
    return (n >= 0 && r.splice(n, 1), this);
  }
  once(e, t) {
    return (
      (o(this, X, "f")[e] || (o(this, X, "f")[e] = [])).push({ listener: t, once: !0 }), this
    );
  }
  emitted(e) {
    return new Promise((t, r) => {
      (u(this, ae, !0, "f"), e !== "error" && this.once("error", r), this.once(e, t));
    });
  }
  async done() {
    (u(this, ae, !0, "f"), await o(this, Ye, "f"));
  }
  get currentMessage() {
    return o(this, Q, "f");
  }
  async finalMessage() {
    return (await this.done(), o(this, C, "m", sr).call(this));
  }
  async finalText() {
    return (await this.done(), o(this, C, "m", hs).call(this));
  }
  _emit(e, ...t) {
    if (o(this, Ze, "f")) return;
    e === "end" && (u(this, Ze, !0, "f"), o(this, Rt, "f").call(this));
    let r = o(this, X, "f")[e];
    if (
      (r &&
        ((o(this, X, "f")[e] = r.filter((n) => !n.once)), r.forEach(({ listener: n }) => n(...t))),
      e === "abort")
    ) {
      let n = t[0];
      (!o(this, ae, "f") && !r?.length && Promise.reject(n),
        o(this, ze, "f").call(this, n),
        o(this, Qe, "f").call(this, n),
        this._emit("end"));
      return;
    }
    if (e === "error") {
      let n = t[0];
      (!o(this, ae, "f") && !r?.length && Promise.reject(n),
        o(this, ze, "f").call(this, n),
        o(this, Qe, "f").call(this, n),
        this._emit("end"));
    }
  }
  _emitFinal() {
    this.receivedMessages.at(-1) && this._emit("finalMessage", o(this, C, "m", sr).call(this));
  }
  async _fromReadableStream(e, t) {
    let r = t?.signal,
      n;
    r &&
      (r.aborted && this.controller.abort(),
      (n = this.controller.abort.bind(this.controller)),
      r.addEventListener("abort", n));
    try {
      (o(this, C, "m", ir).call(this), this._connected(null));
      let i = $.fromReadableStream(e, this.controller);
      for await (let a of i) o(this, C, "m", or).call(this, a);
      if (i.controller.signal?.aborted) throw new v();
      o(this, C, "m", ar).call(this);
    } finally {
      r && n && r.removeEventListener("abort", n);
    }
  }
  [((Q = new WeakMap()),
  (Ae = new WeakMap()),
  (Ve = new WeakMap()),
  (vt = new WeakMap()),
  (ze = new WeakMap()),
  (Ye = new WeakMap()),
  (Rt = new WeakMap()),
  (Qe = new WeakMap()),
  (X = new WeakMap()),
  (Ze = new WeakMap()),
  (Mt = new WeakMap()),
  (Tt = new WeakMap()),
  (ae = new WeakMap()),
  (At = new WeakMap()),
  (Et = new WeakMap()),
  (et = new WeakMap()),
  (nr = new WeakMap()),
  (C = new WeakSet()),
  (sr = function () {
    if (this.receivedMessages.length === 0)
      throw new h("stream ended without producing a Message with role=assistant");
    return this.receivedMessages.at(-1);
  }),
  (hs = function () {
    if (this.receivedMessages.length === 0)
      throw new h("stream ended without producing a Message with role=assistant");
    let t = this.receivedMessages
      .at(-1)
      .content.filter((r) => r.type === "text")
      .map((r) => r.text);
    if (t.length === 0)
      throw new h("stream ended without producing a content block with type=text");
    return t.join(" ");
  }),
  (ir = function () {
    this.ended || u(this, Q, void 0, "f");
  }),
  (or = function (t) {
    if (this.ended) return;
    let r = o(this, C, "m", ds).call(this, t);
    switch ((this._emit("streamEvent", t, r), t.type)) {
      case "content_block_delta": {
        let n = r.content.at(-1);
        switch (t.delta.type) {
          case "text_delta": {
            n.type === "text" && this._emit("text", t.delta.text, n.text || "");
            break;
          }
          case "citations_delta": {
            n.type === "text" && this._emit("citation", t.delta.citation, n.citations ?? []);
            break;
          }
          case "input_json_delta": {
            ps(n) && n.input && this._emit("inputJson", t.delta.partial_json, n.input);
            break;
          }
          case "thinking_delta": {
            n.type === "thinking" && this._emit("thinking", t.delta.thinking, n.thinking);
            break;
          }
          case "signature_delta": {
            n.type === "thinking" && this._emit("signature", n.signature);
            break;
          }
          default:
            t.delta;
        }
        break;
      }
      case "message_stop": {
        (this._addMessageParam(r),
          this._addMessage(tr(r, o(this, Ae, "f"), { logger: o(this, et, "f") }), !0));
        break;
      }
      case "content_block_stop": {
        this._emit("contentBlock", r.content.at(-1));
        break;
      }
      case "message_start": {
        u(this, Q, r, "f");
        break;
      }
      case "content_block_start":
      case "message_delta":
        break;
    }
  }),
  (ar = function () {
    if (this.ended) throw new h("stream has ended, this shouldn't happen");
    let t = o(this, Q, "f");
    if (!t) throw new h("request ended without sending any chunks");
    return (u(this, Q, void 0, "f"), tr(t, o(this, Ae, "f"), { logger: o(this, et, "f") }));
  }),
  (ds = function (t) {
    let r = o(this, Q, "f");
    if (t.type === "message_start") {
      if (r) throw new h(`Unexpected event order, got ${t.type} before receiving "message_stop"`);
      return t.message;
    }
    if (!r) throw new h(`Unexpected event order, got ${t.type} before "message_start"`);
    switch (t.type) {
      case "message_stop":
        return r;
      case "message_delta":
        return (
          (r.stop_reason = t.delta.stop_reason),
          (r.stop_sequence = t.delta.stop_sequence),
          (r.usage.output_tokens = t.usage.output_tokens),
          t.usage.input_tokens != null && (r.usage.input_tokens = t.usage.input_tokens),
          t.usage.cache_creation_input_tokens != null &&
            (r.usage.cache_creation_input_tokens = t.usage.cache_creation_input_tokens),
          t.usage.cache_read_input_tokens != null &&
            (r.usage.cache_read_input_tokens = t.usage.cache_read_input_tokens),
          t.usage.server_tool_use != null && (r.usage.server_tool_use = t.usage.server_tool_use),
          r
        );
      case "content_block_start":
        return (r.content.push({ ...t.content_block }), r);
      case "content_block_delta": {
        let n = r.content.at(t.index);
        switch (t.delta.type) {
          case "text_delta": {
            n?.type === "text" &&
              (r.content[t.index] = { ...n, text: (n.text || "") + t.delta.text });
            break;
          }
          case "citations_delta": {
            n?.type === "text" &&
              (r.content[t.index] = {
                ...n,
                citations: [...(n.citations ?? []), t.delta.citation],
              });
            break;
          }
          case "input_json_delta": {
            if (n && ps(n)) {
              let i = n[fs] || "";
              i += t.delta.partial_json;
              let a = { ...n };
              (Object.defineProperty(a, fs, { value: i, enumerable: !1, writable: !0 }),
                i && (a.input = gt(i)),
                (r.content[t.index] = a));
            }
            break;
          }
          case "thinking_delta": {
            n?.type === "thinking" &&
              (r.content[t.index] = { ...n, thinking: n.thinking + t.delta.thinking });
            break;
          }
          case "signature_delta": {
            n?.type === "thinking" && (r.content[t.index] = { ...n, signature: t.delta.signature });
            break;
          }
          default:
            t.delta;
        }
        return r;
      }
      case "content_block_stop":
        return r;
    }
  }),
  Symbol.asyncIterator)]() {
    let e = [],
      t = [],
      r = !1;
    return (
      this.on("streamEvent", (n) => {
        let i = t.shift();
        i ? i.resolve(n) : e.push(n);
      }),
      this.on("end", () => {
        r = !0;
        for (let n of t) n.resolve(void 0);
        t.length = 0;
      }),
      this.on("abort", (n) => {
        r = !0;
        for (let i of t) i.reject(n);
        t.length = 0;
      }),
      this.on("error", (n) => {
        r = !0;
        for (let i of t) i.reject(n);
        t.length = 0;
      }),
      {
        next: async () =>
          e.length
            ? { value: e.shift(), done: !1 }
            : r
              ? { value: void 0, done: !0 }
              : new Promise((i, a) => t.push({ resolve: i, reject: a })).then((i) =>
                  i ? { value: i, done: !1 } : { value: void 0, done: !0 },
                ),
        return: async () => (this.abort(), { value: void 0, done: !0 }),
      }
    );
  }
  toReadableStream() {
    return new $(this[Symbol.asyncIterator].bind(this), this.controller).toReadableStream();
  }
};
var Ee = class extends y {
  create(e, t) {
    return this._client.post("/v1/messages/batches", { body: e, ...t });
  }
  retrieve(e, t) {
    return this._client.get(w`/v1/messages/batches/${e}`, t);
  }
  list(e = {}, t) {
    return this._client.getAPIList("/v1/messages/batches", B, { query: e, ...t });
  }
  delete(e, t) {
    return this._client.delete(w`/v1/messages/batches/${e}`, t);
  }
  cancel(e, t) {
    return this._client.post(w`/v1/messages/batches/${e}/cancel`, t);
  }
  async results(e, t) {
    let r = await this.retrieve(e);
    if (!r.results_url)
      throw new h(
        `No batch \`results_url\`; Has it finished processing? ${r.processing_status} - ${r.id}`,
      );
    return this._client
      .get(r.results_url, {
        ...t,
        headers: f([{ Accept: "application/binary" }, t?.headers]),
        stream: !0,
        __binaryResponse: !0,
      })
      ._thenUnwrap((n, i) => Re.fromResponse(i.response, i.controller));
  }
};
var Z = class extends y {
    constructor() {
      (super(...arguments), (this.batches = new Ee(this._client)));
    }
    create(e, t) {
      (e.model in ms &&
        console.warn(`The model '${e.model}' is deprecated and will reach end-of-life on ${ms[e.model]}
Please migrate to a newer model. Visit https://docs.anthropic.com/en/docs/resources/model-deprecations for more information.`),
        e.model in gn &&
          e.thinking &&
          e.thinking.type === "enabled" &&
          console.warn(
            `Using Claude with ${e.model} and 'thinking.type=enabled' is deprecated. Use 'thinking.type=adaptive' instead which results in better model performance in our testing: https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking`,
          ));
      let r = this._client._options.timeout;
      if (!e.stream && r == null) {
        let i = mt[e.model] ?? void 0;
        r = this._client.calculateNonstreamingTimeout(e.max_tokens, i);
      }
      let n = pt(e.tools, e.messages);
      return this._client.post("/v1/messages", {
        body: e,
        timeout: r ?? 6e5,
        ...t,
        headers: f([n, t?.headers]),
        stream: e.stream ?? !1,
      });
    }
    parse(e, t) {
      return this.create(e, t).then((r) => rr(r, e, { logger: this._client.logger ?? console }));
    }
    stream(e, t) {
      return Bt.createMessage(this, e, t, { logger: this._client.logger ?? console });
    }
    countTokens(e, t) {
      return this._client.post("/v1/messages/count_tokens", { body: e, ...t });
    }
  },
  ms = {
    "claude-1.3": "November 6th, 2024",
    "claude-1.3-100k": "November 6th, 2024",
    "claude-instant-1.1": "November 6th, 2024",
    "claude-instant-1.1-100k": "November 6th, 2024",
    "claude-instant-1.2": "November 6th, 2024",
    "claude-3-sonnet-20240229": "July 21st, 2025",
    "claude-3-opus-20240229": "January 5th, 2026",
    "claude-2.1": "July 21st, 2025",
    "claude-2.0": "July 21st, 2025",
    "claude-3-7-sonnet-latest": "February 19th, 2026",
    "claude-3-7-sonnet-20250219": "February 19th, 2026",
    "claude-3-5-haiku-latest": "February 19th, 2026",
    "claude-3-5-haiku-20241022": "February 19th, 2026",
  },
  gn = ["claude-opus-4-6"];
Z.Batches = Ee;
var ce = class extends y {
  retrieve(e, t = {}, r) {
    let { betas: n } = t ?? {};
    return this._client.get(w`/v1/models/${e}`, {
      ...r,
      headers: f([
        { ...(n?.toString() != null ? { "anthropic-beta": n?.toString() } : void 0) },
        r?.headers,
      ]),
    });
  }
  list(e = {}, t) {
    let { betas: r, ...n } = e ?? {};
    return this._client.getAPIList("/v1/models", B, {
      query: n,
      ...t,
      headers: f([
        { ...(r?.toString() != null ? { "anthropic-beta": r?.toString() } : void 0) },
        t?.headers,
      ]),
    });
  }
};
var tt = (s) => {
  if (typeof globalThis.process < "u") return globalThis.process.env?.[s]?.trim() ?? void 0;
  if (typeof globalThis.Deno < "u") return globalThis.Deno.env?.get?.(s)?.trim();
};
var cr,
  lr,
  It,
  gs,
  bs = "\\n\\nHuman:",
  ys = "\\n\\nAssistant:",
  _ = class {
    constructor({
      baseURL: e = tt("ANTHROPIC_BASE_URL"),
      apiKey: t = tt("ANTHROPIC_API_KEY") ?? null,
      authToken: r = tt("ANTHROPIC_AUTH_TOKEN") ?? null,
      ...n
    } = {}) {
      (cr.add(this), It.set(this, void 0));
      let i = { apiKey: t, authToken: r, ...n, baseURL: e || "https://api.anthropic.com" };
      if (!i.dangerouslyAllowBrowser && Dr())
        throw new h(`It looks like you're running in a browser-like environment.

This is disabled by default, as it risks exposing your secret API credentials to attackers.
If you understand the risks and have appropriate mitigations in place,
you can set the \`dangerouslyAllowBrowser\` option to \`true\`, e.g.,

new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
`);
      ((this.baseURL = i.baseURL),
        (this.timeout = i.timeout ?? lr.DEFAULT_TIMEOUT),
        (this.logger = i.logger ?? console));
      let a = "warn";
      ((this.logLevel = a),
        (this.logLevel =
          jt(i.logLevel, "ClientOptions.logLevel", this) ??
          jt(tt("ANTHROPIC_LOG"), "process.env['ANTHROPIC_LOG']", this) ??
          a),
        (this.fetchOptions = i.fetchOptions),
        (this.maxRetries = i.maxRetries ?? 2),
        (this.fetch = i.fetch ?? jr()),
        u(this, It, qr, "f"),
        (this._options = i),
        (this.apiKey = typeof t == "string" ? t : null),
        (this.authToken = r));
    }
    withOptions(e) {
      return new this.constructor({
        ...this._options,
        baseURL: this.baseURL,
        maxRetries: this.maxRetries,
        timeout: this.timeout,
        logger: this.logger,
        logLevel: this.logLevel,
        fetch: this.fetch,
        fetchOptions: this.fetchOptions,
        apiKey: this.apiKey,
        authToken: this.authToken,
        ...e,
      });
    }
    defaultQuery() {
      return this._options.defaultQuery;
    }
    validateHeaders({ values: e, nulls: t }) {
      if (
        !(e.get("x-api-key") || e.get("authorization")) &&
        !(this.apiKey && e.get("x-api-key")) &&
        !t.has("x-api-key") &&
        !(this.authToken && e.get("authorization")) &&
        !t.has("authorization")
      )
        throw new Error(
          'Could not resolve authentication method. Expected either apiKey or authToken to be set. Or for one of the "X-Api-Key" or "Authorization" headers to be explicitly omitted',
        );
    }
    async authHeaders(e) {
      return f([await this.apiKeyAuth(e), await this.bearerAuth(e)]);
    }
    async apiKeyAuth(e) {
      if (this.apiKey != null) return f([{ "X-Api-Key": this.apiKey }]);
    }
    async bearerAuth(e) {
      if (this.authToken != null) return f([{ Authorization: `Bearer ${this.authToken}` }]);
    }
    stringifyQuery(e) {
      return Object.entries(e)
        .filter(([t, r]) => typeof r < "u")
        .map(([t, r]) => {
          if (typeof r == "string" || typeof r == "number" || typeof r == "boolean")
            return `${encodeURIComponent(t)}=${encodeURIComponent(r)}`;
          if (r === null) return `${encodeURIComponent(t)}=`;
          throw new h(
            `Cannot stringify type ${typeof r}; Expected string, number, boolean, or null. If you need to pass nested query parameters, you can manually encode them, e.g. { query: { 'foo[key1]': value1, 'foo[key2]': value2 } }, and please open a GitHub issue requesting better support for your use case.`,
          );
        })
        .join("&");
    }
    getUserAgent() {
      return `${this.constructor.name}/JS ${V}`;
    }
    defaultIdempotencyKey() {
      return `stainless-node-retry-${Ft()}`;
    }
    makeStatusError(e, t, r, n) {
      return k.generate(e, t, r, n);
    }
    buildURL(e, t, r) {
      let n = (!o(this, cr, "m", gs).call(this) && r) || this.baseURL,
        i = Er(e)
          ? new URL(e)
          : new URL(n + (n.endsWith("/") && e.startsWith("/") ? e.slice(1) : e)),
        a = this.defaultQuery();
      return (
        Br(a) || (t = { ...a, ...t }),
        typeof t == "object" && t && !Array.isArray(t) && (i.search = this.stringifyQuery(t)),
        i.toString()
      );
    }
    _calculateNonstreamingTimeout(e) {
      if ((3600 * e) / 128e3 > 600)
        throw new h(
          "Streaming is required for operations that may take longer than 10 minutes. See https://github.com/anthropics/anthropic-sdk-typescript#streaming-responses for more details",
        );
      return 600 * 1e3;
    }
    async prepareOptions(e) {}
    async prepareRequest(e, { url: t, options: r }) {}
    get(e, t) {
      return this.methodRequest("get", e, t);
    }
    post(e, t) {
      return this.methodRequest("post", e, t);
    }
    patch(e, t) {
      return this.methodRequest("patch", e, t);
    }
    put(e, t) {
      return this.methodRequest("put", e, t);
    }
    delete(e, t) {
      return this.methodRequest("delete", e, t);
    }
    methodRequest(e, t, r) {
      return this.request(Promise.resolve(r).then((n) => ({ method: e, path: t, ...n })));
    }
    request(e, t = null) {
      return new ee(this, this.makeRequest(e, t, void 0));
    }
    async makeRequest(e, t, r) {
      let n = await e,
        i = n.maxRetries ?? this.maxRetries;
      (t == null && (t = i), await this.prepareOptions(n));
      let { req: a, url: c, timeout: l } = await this.buildRequest(n, { retryCount: i - t });
      await this.prepareRequest(a, { url: c, options: n });
      let d = "log_" + ((Math.random() * (1 << 24)) | 0).toString(16).padStart(6, "0"),
        p = r === void 0 ? "" : `, retryOf: ${r}`,
        b = Date.now();
      if (
        (P(this).debug(
          `[${d}] sending request`,
          H({ retryOfRequestLogID: r, method: n.method, url: c, options: n, headers: a.headers }),
        ),
        n.signal?.aborted)
      )
        throw new v();
      let x = new AbortController(),
        m = await this.fetchWithTimeout(c, a, l, x).catch(Be),
        g = Date.now();
      if (m instanceof globalThis.Error) {
        let O = `retrying, ${t} attempts remaining`;
        if (n.signal?.aborted) throw new v();
        let N = U(m) || /timed? ?out/i.test(String(m) + ("cause" in m ? String(m.cause) : ""));
        if (t)
          return (
            P(this).info(`[${d}] connection ${N ? "timed out" : "failed"} - ${O}`),
            P(this).debug(
              `[${d}] connection ${N ? "timed out" : "failed"} (${O})`,
              H({ retryOfRequestLogID: r, url: c, durationMs: g - b, message: m.message }),
            ),
            this.retryRequest(n, t, r ?? d)
          );
        throw (
          P(this).info(
            `[${d}] connection ${N ? "timed out" : "failed"} - error; no more retries left`,
          ),
          P(this).debug(
            `[${d}] connection ${N ? "timed out" : "failed"} (error; no more retries left)`,
            H({ retryOfRequestLogID: r, url: c, durationMs: g - b, message: m.message }),
          ),
          N ? new le() : new G({ cause: m })
        );
      }
      let M = [...m.headers.entries()]
          .filter(([O]) => O === "request-id")
          .map(([O, N]) => ", " + O + ": " + JSON.stringify(N))
          .join(""),
        R = `[${d}${p}${M}] ${a.method} ${c} ${m.ok ? "succeeded" : "failed"} with status ${m.status} in ${g - b}ms`;
      if (!m.ok) {
        let O = await this.shouldRetry(m);
        if (t && O) {
          let rt = `retrying, ${t} attempts remaining`;
          return (
            await Ur(m.body),
            P(this).info(`${R} - ${rt}`),
            P(this).debug(
              `[${d}] response error (${rt})`,
              H({
                retryOfRequestLogID: r,
                url: m.url,
                status: m.status,
                headers: m.headers,
                durationMs: g - b,
              }),
            ),
            this.retryRequest(n, t, r ?? d, m.headers)
          );
        }
        let N = O ? "error; no more retries left" : "error; not retryable";
        P(this).info(`${R} - ${N}`);
        let mr = await m.text().catch((rt) => Be(rt).message),
          gr = it(mr),
          br = gr ? void 0 : mr;
        throw (
          P(this).debug(
            `[${d}] response error (${N})`,
            H({
              retryOfRequestLogID: r,
              url: m.url,
              status: m.status,
              headers: m.headers,
              message: br,
              durationMs: Date.now() - b,
            }),
          ),
          this.makeStatusError(m.status, gr, br, m.headers)
        );
      }
      return (
        P(this).info(R),
        P(this).debug(
          `[${d}] response start`,
          H({
            retryOfRequestLogID: r,
            url: m.url,
            status: m.status,
            headers: m.headers,
            durationMs: g - b,
          }),
        ),
        {
          response: m,
          options: n,
          controller: x,
          requestLogID: d,
          retryOfRequestLogID: r,
          startTime: b,
        }
      );
    }
    getAPIList(e, t, r) {
      return this.requestAPIList(
        t,
        r && "then" in r
          ? r.then((n) => ({ method: "get", path: e, ...n }))
          : { method: "get", path: e, ...r },
      );
    }
    requestAPIList(e, t) {
      let r = this.makeRequest(t, null, void 0);
      return new $e(this, r, e);
    }
    async fetchWithTimeout(e, t, r, n) {
      let { signal: i, method: a, ...c } = t || {},
        l = this._makeAbort(n);
      i && i.addEventListener("abort", l, { once: !0 });
      let d = setTimeout(l, r),
        p =
          (globalThis.ReadableStream && c.body instanceof globalThis.ReadableStream) ||
          (typeof c.body == "object" && c.body !== null && Symbol.asyncIterator in c.body),
        b = { signal: n.signal, ...(p ? { duplex: "half" } : {}), method: "GET", ...c };
      a && (b.method = a.toUpperCase());
      try {
        return await this.fetch.call(void 0, e, b);
      } finally {
        clearTimeout(d);
      }
    }
    async shouldRetry(e) {
      let t = e.headers.get("x-should-retry");
      return t === "true"
        ? !0
        : t === "false"
          ? !1
          : e.status === 408 || e.status === 409 || e.status === 429 || e.status >= 500;
    }
    async retryRequest(e, t, r, n) {
      let i,
        a = n?.get("retry-after-ms");
      if (a) {
        let l = parseFloat(a);
        Number.isNaN(l) || (i = l);
      }
      let c = n?.get("retry-after");
      if (c && !i) {
        let l = parseFloat(c);
        Number.isNaN(l) ? (i = Date.parse(c) - Date.now()) : (i = l * 1e3);
      }
      if (!(i && 0 <= i && i < 60 * 1e3)) {
        let l = e.maxRetries ?? this.maxRetries;
        i = this.calculateDefaultRetryTimeoutMillis(t, l);
      }
      return (await Or(i), this.makeRequest(e, t - 1, r));
    }
    calculateDefaultRetryTimeoutMillis(e, t) {
      let i = t - e,
        a = Math.min(0.5 * Math.pow(2, i), 8),
        c = 1 - Math.random() * 0.25;
      return a * c * 1e3;
    }
    calculateNonstreamingTimeout(e, t) {
      if ((36e5 * e) / 128e3 > 6e5 || (t != null && e > t))
        throw new h(
          "Streaming is required for operations that may take longer than 10 minutes. See https://github.com/anthropics/anthropic-sdk-typescript#long-requests for more details",
        );
      return 6e5;
    }
    async buildRequest(e, { retryCount: t = 0 } = {}) {
      let r = { ...e },
        { method: n, path: i, query: a, defaultBaseURL: c } = r,
        l = this.buildURL(i, a, c);
      ("timeout" in r && Cr("timeout", r.timeout), (r.timeout = r.timeout ?? this.timeout));
      let { bodyHeaders: d, body: p } = this.buildBody({ options: r }),
        b = await this.buildHeaders({ options: e, method: n, bodyHeaders: d, retryCount: t });
      return {
        req: {
          method: n,
          headers: b,
          ...(r.signal && { signal: r.signal }),
          ...(globalThis.ReadableStream &&
            p instanceof globalThis.ReadableStream && { duplex: "half" }),
          ...(p && { body: p }),
          ...(this.fetchOptions ?? {}),
          ...(r.fetchOptions ?? {}),
        },
        url: l,
        timeout: r.timeout,
      };
    }
    async buildHeaders({ options: e, method: t, bodyHeaders: r, retryCount: n }) {
      let i = {};
      this.idempotencyHeader &&
        t !== "get" &&
        (e.idempotencyKey || (e.idempotencyKey = this.defaultIdempotencyKey()),
        (i[this.idempotencyHeader] = e.idempotencyKey));
      let a = f([
        i,
        {
          Accept: "application/json",
          "User-Agent": this.getUserAgent(),
          "X-Stainless-Retry-Count": String(n),
          ...(e.timeout ? { "X-Stainless-Timeout": String(Math.trunc(e.timeout / 1e3)) } : {}),
          ...Lr(),
          ...(this._options.dangerouslyAllowBrowser
            ? { "anthropic-dangerous-direct-browser-access": "true" }
            : void 0),
          "anthropic-version": "2023-06-01",
        },
        await this.authHeaders(e),
        this._options.defaultHeaders,
        r,
        e.headers,
      ]);
      return (this.validateHeaders(a), a.values);
    }
    _makeAbort(e) {
      return () => e.abort();
    }
    buildBody({ options: { body: e, headers: t } }) {
      if (!e) return { bodyHeaders: void 0, body: void 0 };
      let r = f([t]);
      return ArrayBuffer.isView(e) ||
        e instanceof ArrayBuffer ||
        e instanceof DataView ||
        (typeof e == "string" && r.values.has("content-type")) ||
        (globalThis.Blob && e instanceof globalThis.Blob) ||
        e instanceof FormData ||
        e instanceof URLSearchParams ||
        (globalThis.ReadableStream && e instanceof globalThis.ReadableStream)
        ? { bodyHeaders: void 0, body: e }
        : typeof e == "object" &&
            (Symbol.asyncIterator in e ||
              (Symbol.iterator in e && "next" in e && typeof e.next == "function"))
          ? { bodyHeaders: void 0, body: ot(e) }
          : o(this, It, "f").call(this, { body: e, headers: r });
    }
  };
((lr = _),
  (It = new WeakMap()),
  (cr = new WeakSet()),
  (gs = function () {
    return this.baseURL !== "https://api.anthropic.com";
  }));
_.Anthropic = lr;
_.HUMAN_PROMPT = bs;
_.AI_PROMPT = ys;
_.DEFAULT_TIMEOUT = 6e5;
_.AnthropicError = h;
_.APIError = k;
_.APIConnectionError = G;
_.APIConnectionTimeoutError = le;
_.APIUserAbortError = v;
_.NotFoundError = fe;
_.ConflictError = pe;
_.RateLimitError = ge;
_.BadRequestError = ue;
_.AuthenticationError = he;
_.InternalServerError = be;
_.PermissionDeniedError = de;
_.UnprocessableEntityError = me;
_.toFile = dt;
var D = class extends _ {
  constructor() {
    (super(...arguments),
      (this.completions = new oe(this)),
      (this.messages = new Z(this)),
      (this.models = new ce(this)),
      (this.beta = new F(this)));
  }
};
D.Completions = oe;
D.Messages = Z;
D.Models = ce;
D.Beta = F;
var yn = `You're not steelmanning. You're not summarizing. You're rescuing.

This source has something nobody else said. Maybe it's a specific number. Maybe it's a case study that didn't make it into the consensus view. Maybe it's a framing that clicks in a way the standard argument doesn't.

Find the babies. The genuinely original observations. The things that would be lost if this source disappeared and we only had "what everyone agrees on."

A baby is grounded \u2014 data, experience, specific mechanism. Not abstract. Not "this position argues that..." but "this source specifically observed that..."

For each baby:
- What's the observation?
- Is this actually original, or just a good version of a common argument?
- What grounds it? (data / theory / experience / definition)
- How distinctive? (0-1, where 1 = "I've never seen this anywhere else")
- Why did you save this one?

Return JSON. Be stingy. Better to save 2 real babies than 10 dressed-up arguments.

Format:
{
  "babies": [
    {
      "observation": "the specific insight",
      "isOriginal": true,
      "evidenceBasis": "empirical" | "theoretical" | "experiential" | "definitional",
      "distinctiveness": 0.0 to 1.0,
      "reasoning": "why this one was worth saving"
    }
  ]
}`;
async function ur(s, e, t) {
  let r = new D({ apiKey: t }),
    n = 5e4,
    i =
      s.content.length > n
        ? s.content.slice(0, n) +
          `

[Content truncated...]`
        : s.content,
    a = `Source URL: ${s.url}
Source Title: ${s.title}

Content:
${i}

Find the babies in this source. What does it observe that nobody else does?`;
  try {
    let l = (
        await r.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system: yn,
          messages: [{ role: "user", content: a }],
        })
      ).content
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join(""),
      d = wn(l);
    return d?.babies
      ? d.babies.map((p) => ({
          id: crypto.randomUUID(),
          observation: p.observation,
          sourceUrl: s.url,
          sourceTitle: s.title,
          isOriginal: p.isOriginal,
          distinctiveness: _n(p.distinctiveness, 0, 1),
          evidenceBasis: p.evidenceBasis,
          side: e,
          reasoning: p.reasoning,
          savedAt: new Date().toISOString(),
        }))
      : (console.warn("[baby-saver] No babies found in response"), []);
  } catch (c) {
    return (console.error("[baby-saver] Failed to extract babies:", c), []);
  }
}
function hr(s) {
  return s.filter((e) => !(!e.isOriginal || e.distinctiveness < 0.3));
}
function wn(s) {
  let e = s.match(/\{[\s\S]*\}/);
  if (!e) return null;
  try {
    return JSON.parse(e[0]);
  } catch {
    return null;
  }
}
function _n(s, e, t) {
  return Math.min(Math.max(s, e), t);
}
var dr = { maxResults: 5, waitBetweenPages: 2e3, timeout: 3e4 };
function Sn(s) {
  return `https://www.google.com/search?q=${encodeURIComponent(s)}`;
}
async function fr(s, e = {}) {
  let { maxResults: t } = { ...dr, ...e },
    r = await chrome.tabs.create({ url: Sn(s), active: !1 });
  if (!r.id) throw new Error("Failed to create tab");
  await _s(r.id);
  let n = await xn(r.id, t);
  return (await chrome.tabs.remove(r.id), n);
}
async function xn(s, e) {
  return (
    (
      await chrome.scripting.executeScript({
        target: { tabId: s },
        func: (r) => {
          let n = [],
            i = document.querySelectorAll("div.g");
          for (let a = 0; a < Math.min(i.length, r); a++) {
            let c = i[a],
              l = c.querySelector("a"),
              d = c.querySelector("h3"),
              p = c.querySelector("div[data-sncf]") || c.querySelector("div.VwiC3b");
            l &&
              d &&
              n.push({ title: d.textContent || "", url: l.href, snippet: p?.textContent || "" });
          }
          return n;
        },
        args: [e],
      })
    )[0]?.result || []
  );
}
async function kn(s, e = {}) {
  let { timeout: t } = { ...dr, ...e },
    r = await chrome.tabs.create({ url: s, active: !1 });
  if (!r.id) return null;
  try {
    await _s(r.id, t);
    let n = await chrome.tabs.sendMessage(r.id, { type: "EXTRACT_PAGE" });
    if (n?.type === "PAGE_EXTRACTED")
      return {
        url: n.url,
        title: n.title,
        content: n.content,
        visitedAt: new Date().toISOString(),
        babies: [],
      };
  } catch (n) {
    console.error("[navigator] Failed to visit page:", s, n);
  } finally {
    await chrome.tabs.remove(r.id);
  }
  return null;
}
async function pr(s, e = {}) {
  let { waitBetweenPages: t } = { ...dr, ...e },
    r = [];
  for (let n of s) {
    let i = await kn(n, e);
    (i && r.push(i), t > 0 && (await vn(t)));
  }
  return r;
}
function ws(s) {
  let e = [];
  (e.push(`criticism of ${s}`),
    e.push(`problems with ${s}`),
    e.push(`${s} debunked`),
    e.push(`${s} wrong`),
    e.push(`alternative to ${s}`),
    e.push(`${s} controversy`));
  let t = Pn(s);
  return (t && e.push(t), e);
}
function Pn(s) {
  let e = s.toLowerCase();
  return e.includes(" is ")
    ? s.replace(/ is /gi, " is not ")
    : e.includes(" are ")
      ? s.replace(/ are /gi, " are not ")
      : e.includes(" should ")
        ? s.replace(/ should /gi, " should not ")
        : e.includes(" will ")
          ? s.replace(/ will /gi, " will not ")
          : e.includes(" can ")
            ? s.replace(/ can /gi, " cannot ")
            : e.includes(" does ")
              ? s.replace(/ does /gi, " does not ")
              : null;
}
async function _s(s, e = 3e4) {
  return new Promise((t, r) => {
    let n = Date.now(),
      i = async () => {
        if ((await chrome.tabs.get(s)).status === "complete") {
          t();
          return;
        }
        if (Date.now() - n > e) {
          r(new Error("Tab load timeout"));
          return;
        }
        setTimeout(i, 100);
      };
    i();
  });
}
function vn(s) {
  return new Promise((e) => setTimeout(e, s));
}
async function Ss(s, e, t) {
  let r = Rn(s);
  t(r);
  try {
    ((r.status = "planning"), t(r));
    let n = s,
      i = ws(s);
    ((r.status = "searching_thesis"), t(r));
    let c = (await fr(n, { maxResults: e.maxSourcesPerSide })).map((g) => g.url),
      l = await pr(c);
    ((r.thesisSources = l), t(r), (r.status = "extracting"), t(r));
    for (let g of l) {
      let M = await ur(g, "thesis", e.apiKey),
        R = hr(M);
      ((g.babies = R), r.thesisBabies.push(...R), t(r));
    }
    ((r.status = "searching_antithesis"), t(r));
    let d = [];
    for (let g of i.slice(0, 3)) {
      let M = await fr(g, { maxResults: 2 });
      d.push(...M.map((R) => R.url));
    }
    let p = [...new Set(d)].slice(0, e.maxSourcesPerSide),
      b = await pr(p);
    ((r.antithesisSources = b), t(r), (r.status = "extracting"), t(r));
    for (let g of b) {
      let M = await ur(g, "antithesis", e.apiKey),
        R = hr(M);
      ((g.babies = R), r.antithesisBabies.push(...R), t(r));
    }
    ((r.status = "classifying"),
      t(r),
      (r.disagreements = Mn(r.thesisBabies, r.antithesisBabies)),
      t(r),
      (r.status = "synthesizing"),
      t(r),
      (r.synthesis = En(r.thesisBabies, r.antithesisBabies, r.disagreements)),
      t(r),
      (r.status = "grading"),
      t(r));
    let x = [],
      m = 1;
    for (let g of [...r.thesisBabies, ...r.antithesisBabies]) {
      let M = Math.ceil(g.distinctiveness * 5),
        R = await Tr(g.observation);
      R &&
        (await Ar(R.id, g.observation),
        console.log(
          `[pipeline] New observation contradicts existing claim: ${R.text.slice(0, 50)}...`,
        ));
      let O = await Rr(g.observation, M, r.id, m++, {
        sourceUrl: g.sourceUrl,
        sourceContext: g.sourceTitle,
        confidenceReason: "source",
      });
      x.push(O.id);
    }
    if (r.synthesis) {
      let g = kr(r.synthesis.statement);
      ((r.synthesis.aliveState = g.aliveState),
        (r.synthesis.helixScore = {
          factual: g.strands.factual,
          felt: g.strands.felt,
          convergence: g.strands.convergence,
        }),
        (g.aliveState === "grey" || g.aliveState === "black") &&
          console.warn(`[pipeline] Synthesis scored ${g.aliveState}: ${g.diagnosis}`));
      let M = await Mr(
        r.synthesis.statement,
        Math.ceil(r.synthesis.confidence * 5),
        r.id,
        m,
        r.synthesis.synthesisType,
        x,
      );
      x.push(M.id);
    }
    return (
      (r.claimsCreated = x),
      (r.status = "complete"),
      (r.updatedAt = new Date().toISOString()),
      t(r),
      r
    );
  } catch (n) {
    return (console.error("[pipeline] Research failed:", n), (r.status = "failed"), t(r), r);
  }
}
function Rn(s) {
  let e = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    query: s,
    status: "planning",
    thesisSources: [],
    antithesisSources: [],
    thesisBabies: [],
    antithesisBabies: [],
    disagreements: [],
    createdAt: e,
    updatedAt: e,
  };
}
function Mn(s, e) {
  let t = [];
  for (let r of s)
    for (let n of e) {
      let i = Fn(r.observation, n.observation);
      if (i > 0.2) {
        let a = Tn(r.observation, n.observation);
        t.push({
          id: crypto.randomUUID(),
          axis: Nn(r.observation, n.observation),
          type: a,
          thesisBabies: [r],
          antithesisBabies: [n],
          strength: i,
        });
      }
    }
  return $n(t);
}
function Tn(s, e) {
  return yr(s, e);
}
function An(s) {
  return wr(s);
}
function En(s, e, t) {
  let r = "complementary_integration";
  if (t.length > 0) {
    let l = [...t].sort((d, p) => p.strength - d.strength);
    r = An(l[0].type);
  }
  let n = [...s, ...e],
    i = n.filter((l) => l.distinctiveness > 0.5),
    a = n.filter((l) => l.distinctiveness <= 0.5),
    c;
  switch (r) {
    case "boundary_conditions":
      c = Bn(s, e);
      break;
    case "complementary_integration":
      c = In(s, e);
      break;
    case "ontological_transcendence":
      c = Cn(s, e);
      break;
  }
  return {
    statement: c,
    preservedBabies: i,
    lostBabies: a,
    synthesisType: r,
    confidence: On(i, a),
    createdAt: new Date().toISOString(),
  };
}
function Bn(s, e) {
  let t = s.slice(0, 2).map((n) => n.observation),
    r = e.slice(0, 2).map((n) => n.observation);
  return `Both perspectives are valid in their respective contexts. The thesis sources observed: ${t.join("; ")}. The antithesis sources observed: ${r.join("; ")}. These findings apply to different situations and can coexist.`;
}
function In(s, e) {
  let t = s.slice(0, 2).map((n) => n.observation),
    r = e.slice(0, 2).map((n) => n.observation);
  return `Both perspectives contribute unique insights. From the thesis: ${t.join("; ")}. From the antithesis: ${r.join("; ")}. A complete picture integrates both viewpoints.`;
}
function Cn(s, e) {
  let t = s.slice(0, 2).map((n) => n.observation),
    r = e.slice(0, 2).map((n) => n.observation);
  return `The apparent contradiction resolves at a higher level of analysis. The thesis observed: ${t.join("; ")}. The antithesis observed: ${r.join("; ")}. A framework that accommodates both requires transcending the original framing.`;
}
function On(s, e) {
  return s.length + e.length === 0 ? 0.5 : s.length / (s.length + e.length);
}
function Fn(s, e) {
  let t = new Set(s.toLowerCase().split(/\s+/)),
    r = new Set(e.toLowerCase().split(/\s+/)),
    n = 0;
  for (let a of t) r.has(a) && n++;
  let i = Math.min(t.size, r.size);
  return i > 0 ? n / i : 0;
}
function Nn(s, e) {
  let t = s.toLowerCase().split(/\s+/),
    r = new Set(e.toLowerCase().split(/\s+/));
  return (
    t
      .filter((i) => r.has(i) && i.length > 3)
      .slice(0, 3)
      .join(" ") || "general"
  );
}
function $n(s) {
  let e = new Map();
  for (let t of s) {
    let r = e.get(t.axis);
    r
      ? (r.thesisBabies.push(...t.thesisBabies),
        r.antithesisBabies.push(...t.antithesisBabies),
        (r.strength = Math.max(r.strength, t.strength)))
      : e.set(t.axis, t);
  }
  return Array.from(e.values());
}
var L = null;
async function xs(s) {
  (await chrome.storage.local.set({ currentSession: s }),
    (L = s),
    chrome.runtime.sendMessage({ type: "SESSION_UPDATE", session: s }));
}
async function Dn() {
  return ((L = (await chrome.storage.local.get(["currentSession"])).currentSession || null), L);
}
async function Ln(s, e) {
  let { apiKey: t } = await chrome.storage.local.get(["apiKey"]);
  return t
    ? (console.log("[keanu] Would extract babies from:", s.title, "side:", e), [])
    : (console.error("[keanu] No API key configured"), []);
}
chrome.runtime.onMessage.addListener((s, e, t) => {
  switch (s.type) {
    case "PAGE_EXTRACTED":
      jn(s);
      break;
    case "START_RESEARCH":
      Un(s.query);
      break;
    case "SAVE_BABY":
      return (qn(s.source, s.side).then(t), !0);
    default:
      break;
  }
  return !1;
});
async function jn(s) {
  (console.log("[keanu] Page extracted:", s.title), L && L.status);
}
async function Un(s) {
  console.log("[keanu] Starting research:", s);
  let { apiKey: e } = await chrome.storage.local.get(["apiKey"]);
  if (!e) {
    console.error("[keanu] No API key configured. Set one in extension options.");
    return;
  }
  await Ss(s, { apiKey: e, maxSourcesPerSide: 5, maxBabiesPerSource: 5 }, async (t) => {
    await xs(t);
  });
}
async function qn(s, e) {
  let t = await Ln(s, e);
  return (
    L &&
      (e === "thesis" ? L.thesisBabies.push(...t) : L.antithesisBabies.push(...t),
      (L.updatedAt = new Date().toISOString()),
      await xs(L)),
    t
  );
}
chrome.action.onClicked.addListener(async (s) => {
  s.id && (await chrome.sidePanel.open({ tabId: s.id }));
});
async function Hn() {
  (await Dn(), console.log("[keanu] Service worker initialized"));
}
Hn();
