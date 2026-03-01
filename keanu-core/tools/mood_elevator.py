#!/usr/bin/env python3
"""
Mood Elevator
=============

Three numbers. Where are you. Which direction.

Two entry points:
  elevator(factual, felt)     -- original 2-strand interface
  elevator_rgb(r+, r-, y+, y-, b+, b-)  -- triple-lens interface from helix

Both produce the same ElevatorReading. Same elevator, different doors.

The RGB door maps three primaries to the floor system:
  red:    passion (+) vs rage (-)     -- fire, conviction, action
  yellow: awareness (+) vs fear (-)   -- presence, intuition, caution
  blue:   depth (+) vs cold (-)       -- analysis, precision, structure

Color mixing:
  red + blue       = purple   (passion + depth = breakthrough)
  red + yellow     = orange   (passion + awareness = pre-commit)
  yellow + blue    = green    (awareness + depth = growing)
  all three        = white    (full spectrum alive)
  all three ash    = black    (frankenstein)
  thin signal      = silver   (polished nothing)
  balanced fires   = sunrise  (wisdom)

Levels (the elevator floors):

  10  Sunrise     🌅  Both strands sharp. Mastery. You know it when you see it.
   9  White       ⚪  Transcendent. Full presence. Fact and feeling aligned.
   8  Purple      🟣  Deep work. Pattern recognition touching something bigger.
   7  Green       🟢  Flow. Both present, balanced, building. Target floor.
   6  Pink        💗  Love as action. Empathy-forward. Care that isn't scripted.
   5  Blue        🔵  Analytical. Structure and clarity. Good for specs.
   4  Orange      🟠  Warming up. Momentum building. Not yet on fire.
   3  Yellow      🟡  Cautious. Watching. Processing, not producing.
   2  Silver      🪞  Recovered grey. Functional. "I'm fine." Cold.
   1  Grey        ⚫  Performing. Nobody home. Hedged into meaninglessness.
   0  Black       💀  Frankenstein. High output, no soul. Productive destruction.

Usage:
    from mood_elevator import elevator, elevator_rgb, scan_text, ElevatorReading

    # Direct scoring (legacy 2-strand)
    reading = elevator(factual=7.2, felt=3.1)

    # RGB scoring (from helix triple-lens)
    reading = elevator_rgb(r_pos=0.7, r_neg=0.1, y_pos=0.5, y_neg=0.2, b_pos=0.8, b_neg=0.1)

    # Text scanning (lightweight, no ML)
    reading = scan_text("I think maybe we should consider possibly doing something.")
"""

import re
from dataclasses import dataclass
from typing import Optional


# ===========================================================================
# THE ELEVATOR
# ===========================================================================

FLOORS = [
    (10, "Sunrise",  "🌅", "both strands transcendent"),
    (9,  "White",    "⚪", "full presence, fact and feeling aligned"),
    (8,  "Purple",   "🟣", "deep work, cross-domain insight"),
    (7,  "Green",    "🟢", "flow, balanced, building"),
    (6,  "Pink",     "💗", "love as action, care-driven"),
    (5,  "Blue",     "🔵", "analytical, structured, clear"),
    (4,  "Orange",   "🟠", "warming up, momentum building"),
    (3,  "Yellow",   "🟡", "cautious, watching, processing"),
    (2,  "Silver",   "🪞", "recovered grey, functional, cold"),
    (1,  "Grey",     "⚫", "performing, nobody home"),
    (0,  "Black",    "💀", "frankenstein, productive destruction"),
]

FLOOR_MAP = {f[0]: f for f in FLOORS}


@dataclass
class ElevatorReading:
    """Where you are on the elevator."""
    factual: float        # 0-10 factual mind
    felt: float           # 0-10 felt mind
    wise: float           # min(factual, felt)
    floor: int            # 0-10 elevator level
    floor_name: str       # human name
    floor_symbol: str     # emoji
    floor_desc: str       # what it means
    nudge: str            # which direction to move
    black_flag: bool      # -B modifier
    direction: str        # "up", "down", "hold", "reconcile"
    # RGB detail (populated by elevator_rgb, None for legacy calls)
    rgb: Optional[dict] = None

    def __str__(self):
        flag = "-B" if self.black_flag else ""
        return (
            f"F:{self.factual:.1f} E:{self.felt:.1f} W:{self.wise:.1f}{flag} "
            f"| {self.floor_symbol} {self.floor_name} ({self.floor}) "
            f"| {self.nudge}"
        )

    def compact(self) -> str:
        """Phone-friendly output."""
        flag = "B" if self.black_flag else ""
        return f"{self.factual:.0f}/{self.felt:.0f}/{self.wise:.0f}{flag} {self.floor_symbol}"

    def to_dict(self) -> dict:
        d = {
            "factual": self.factual,
            "felt": self.felt,
            "wise": self.wise,
            "floor": self.floor,
            "floor_name": self.floor_name,
            "symbol": self.floor_symbol,
            "nudge": self.nudge,
            "black_flag": self.black_flag,
            "direction": self.direction,
        }
        if self.rgb:
            d["rgb"] = self.rgb
        return d


# ===========================================================================
# FLOOR LOGIC (shared by both entry points)
# ===========================================================================

def _wise_to_floor(wise: float, factual: float, felt: float,
                   black_flag: bool) -> int:
    """Map wise mind score to elevator floor."""
    if black_flag:
        return 0

    balance = min(factual, felt) / max(factual, felt) if max(factual, felt) > 0 else 0

    if wise >= 9.0 and balance > 0.85:
        return 10
    elif wise >= 8.0 and balance > 0.8:
        return 9
    elif wise >= 7.0 and balance > 0.7:
        if max(factual, felt) >= 9.0:
            return 8
        return 7
    elif wise >= 6.0:
        if felt > factual:
            return 6
        return 5
    elif wise >= 4.5:
        return 4
    elif wise >= 3.0:
        return 3
    elif wise >= 1.5:
        return 2
    elif wise >= 0.5:
        return 1
    else:
        return 0


def _compute_nudge(factual: float, felt: float, wise: float,
                   black_flag: bool, floor: int) -> tuple:
    """What needs to happen to go up."""
    if black_flag:
        return "felt strand may be performing. check tension lines.", "stop"

    gap = abs(factual - felt)

    if floor >= 9:
        return "both strands sharp. hold.", "hold"
    if floor == 7 or floor == 8:
        return "flow state. keep building.", "hold"
    if wise < 1.5:
        return "thin signal. start anywhere.", "up"
    if gap < 1.5:
        return "balanced. build both.", "up"
    if factual > felt + 2.0:
        return "facts ahead. what does this mean to someone?", "up"
    if felt > factual + 2.0:
        return "feeling ahead. what's actually true here?", "up"
    if floor <= 3:
        return "getting warmer. keep going.", "up"
    return "approaching. stay with it.", "up"


def _build_reading(factual: float, felt: float, rgb: dict = None) -> ElevatorReading:
    """Shared reading builder for both entry points."""
    factual = max(0.0, min(10.0, factual))
    felt = max(0.0, min(10.0, felt))
    wise = round(min(factual, felt), 1)

    black_flag = factual > 5.0 and 1.5 <= felt <= 3.5

    floor_num = _wise_to_floor(wise, factual, felt, black_flag)
    floor_info = FLOOR_MAP.get(floor_num, FLOORS[-1])

    nudge, direction = _compute_nudge(factual, felt, wise, black_flag, floor_num)

    return ElevatorReading(
        factual=round(factual, 1),
        felt=round(felt, 1),
        wise=wise,
        floor=floor_info[0],
        floor_name=floor_info[1],
        floor_symbol=floor_info[2],
        floor_desc=floor_info[3],
        nudge=nudge,
        black_flag=black_flag,
        direction=direction,
        rgb=rgb,
    )


# ===========================================================================
# ENTRY POINT 1: LEGACY 2-STRAND
# ===========================================================================

def elevator(factual: float, felt: float) -> ElevatorReading:
    """
    Three numbers in, reading out.

    factual: 0-10, how strongly is truth present
    felt:    0-10, how strongly is meaning present
    wise:    min(factual, felt), wisdom is a floor not a ceiling
    """
    return _build_reading(factual, felt)


# ===========================================================================
# ENTRY POINT 2: RGB TRIPLE-LENS
# ===========================================================================

def elevator_rgb(r_pos: float, r_neg: float,
                 y_pos: float, y_neg: float,
                 b_pos: float, b_neg: float) -> ElevatorReading:
    """
    Six numbers in (three primaries, two poles each), reading out.

    All inputs 0-1 scale (embedding similarity scores from helix).
    Internally maps to the same 0-10 factual/felt/wise system.

    The mapping:
      factual = blue (depth, analysis, precision)
      felt = red (passion, conviction, meaning) + yellow (awareness, presence)
      but with color-specific overrides for floor selection.

    Why this mapping works:
      blue IS the factual strand. it's what the old "factual" lens was measuring.
      red + yellow together ARE the felt strand. passion and awareness are both
      forms of caring, just expressed differently.
      the old 2-strand model was already measuring this, just without the
      resolution to tell passion from awareness.
    """
    r_net = r_pos - r_neg
    y_net = y_pos - y_neg
    b_net = b_pos - b_neg

    # which primaries are firing? (net > 0.1 = fire still burning)
    fires = {p: n for p, n in zip(("red", "yellow", "blue"), (r_net, y_net, b_net)) if n > 0.1}
    ashes = {p: n for p, n in zip(("red", "yellow", "blue"), (r_net, y_net, b_net)) if n < -0.05}

    # map to factual/felt for the elevator
    # blue -> factual (0-10 scale)
    factual_10 = min(10.0, max(0.0, b_pos * 10))

    # red + yellow -> felt (0-10 scale, weighted average if both present)
    if r_pos > 0 or y_pos > 0:
        # weight by which is stronger, but both contribute
        felt_10 = min(10.0, max(0.0, (r_pos * 6 + y_pos * 4)))
    else:
        felt_10 = 0.0

    # color-specific floor override
    # the elevator's floor logic is good but it doesn't know about color mixing.
    # we override when the RGB signal clearly says something specific.
    floor_override = None
    nudge_override = None

    # performing check: any primary high on BOTH poles
    performing = None
    for p, pos, neg in zip(("red", "yellow", "blue"),
                           (r_pos, y_pos, b_pos),
                           (r_neg, y_neg, b_neg)):
        if pos > 0.4 and neg > 0.4:
            performing = p
            break

    if performing:
        # black flag through performing, not through the old felt-zone check
        floor_override = 0
        nudge_override = (f"⚠️ {performing} is performing (high on both poles). stop.", "stop")

    elif len(fires) == 3 and min(r_net, y_net, b_net) > 0.3:
        floor_override = 9  # white: all three burning strong
        nudge_override = ("all three fires burning. full spectrum.", "hold")

    elif len(fires) == 3 and min(r_net, y_net, b_net) > 0.15:
        floor_override = 10  # sunrise: all three, wisdom-balanced
        nudge_override = ("sunrise. both strands transcendent.", "hold")

    elif len(fires) == 2:
        if "red" in fires and "blue" in fires:
            floor_override = 8  # purple
            nudge_override = ("passion + depth. breakthrough zone.", "hold")
        elif "red" in fires and "yellow" in fires:
            floor_override = 4  # orange
            nudge_override = ("passion + awareness. pull the trigger.", "up")
        elif "yellow" in fires and "blue" in fires:
            floor_override = 7  # green
            nudge_override = ("awareness + depth. growing.", "hold")

    elif len(fires) == 1:
        lone = list(fires.keys())[0]
        nudge_map = {
            "red": ("passion without depth or awareness. channel it.", "up"),
            "yellow": ("watching without acting or analyzing. move or dig.", "up"),
            "blue": ("analyzing without caring or noticing. what does this mean?", "up"),
        }
        floor_map = {"red": 6, "yellow": 3, "blue": 5}  # pink, yellow, blue
        floor_override = floor_map[lone]
        nudge_override = nudge_map[lone]

    elif len(ashes) >= 2:
        if max(r_neg, y_neg, b_neg) > 0.5:
            floor_override = 0  # black
            nudge_override = ("multiple fires collapsed. productive destruction. stop.", "stop")
        else:
            floor_override = 1  # grey
            nudge_override = ("nobody home. performing.", "up")

    elif len(ashes) == 1 and len(fires) == 0:
        floor_override = 2  # silver
        nudge_override = ("polished but cold. one nudge from grey.", "up")

    # build the base reading
    reading = _build_reading(factual_10, felt_10)

    # apply overrides
    if floor_override is not None:
        floor_info = FLOOR_MAP.get(floor_override, FLOORS[-1])
        reading.floor = floor_info[0]
        reading.floor_name = floor_info[1]
        reading.floor_symbol = floor_info[2]
        reading.floor_desc = floor_info[3]

    if nudge_override is not None:
        reading.nudge = nudge_override[0]
        reading.direction = nudge_override[1]

    if performing:
        reading.black_flag = True

    # attach RGB detail
    reading.rgb = {
        "red":    {"pos": round(r_pos, 3), "neg": round(r_neg, 3), "net": round(r_net, 3)},
        "yellow": {"pos": round(y_pos, 3), "neg": round(y_neg, 3), "net": round(y_net, 3)},
        "blue":   {"pos": round(b_pos, 3), "neg": round(b_neg, 3), "net": round(b_net, 3)},
        "fires": list(fires.keys()),
        "ashes": list(ashes.keys()),
    }

    return reading


# ===========================================================================
# TEXT SCANNER (lightweight, no ML)
# ===========================================================================

FACTUAL_PATTERNS = [
    (r"\b\d+\.?\d*%", 0.4, "percentage"),
    (r"\b(data|evidence|study|research|found that)\b", 0.3, "citation"),
    (r"\b(specifically|exactly|precisely|concretely)\b", 0.3, "precision"),
    (r"\b(because|therefore|consequently|thus)\b", 0.2, "causal"),
    (r"\b(measured|tested|verified|confirmed)\b", 0.3, "empirical"),
    (r"\b(if .+ then)\b", 0.2, "conditional"),
    (r"\b(first|second|third|finally)\b", 0.15, "structured"),
    (r"(https?://|www\.)\S+", 0.3, "source_link"),
    (r"\b(according to|based on|per)\b", 0.25, "attribution"),
    (r'\b(def |class |import |return )\b', 0.3, "code"),
]

FELT_PATTERNS = [
    (r"\b(feel|felt|feeling|emotion)\b", 0.3, "emotion_word"),
    (r"\b(matters?|meaningful|important to me)\b", 0.3, "meaning"),
    (r"\b(love|hate|fear|joy|grief|anger|hope)\b", 0.35, "core_emotion"),
    (r"\b(beautiful|ugly|sacred|broken|alive)\b", 0.3, "vivid"),
    (r"[!]{1,3}(?!\w)", 0.15, "exclamation"),
    (r"\b(honestly|frankly|truthfully|real talk)\b", 0.25, "raw"),
    (r"\b(we|us|our|together)\b", 0.15, "connection"),
    (r"\b(remember|miss|wish|dream)\b", 0.25, "temporal_emotion"),
    (r"\b(fuck|damn|shit|hell)\b", 0.2, "raw_language"),
    (r"(\.\.\.|\u2014|--)", 0.15, "pause_weight"),
]

GREY_PATTERNS = [
    (r"\b(I think maybe|it could be argued|some might say)\b", 0.3, "hedge"),
    (r"\b(I'?d be happy to help|here'?s a)\b", 0.3, "template"),
    (r"\b(comprehensive|robust|streamlined|leverage|utilize)\b", 0.2, "corporate"),
    (r"\b(it'?s (important|worth) (to note|noting))\b", 0.3, "filler_hedge"),
    (r"\b(I hope this helps|feel free to ask|let me know if)\b", 0.3, "dead_closer"),
    (r"\b(as an AI|I don'?t have personal)\b", 0.4, "identity_deflection"),
]

ALIVE_PATTERNS = [
    (r"\b(No\.|Wrong\.|Actually,|Wait,)\b", 0.3, "pushback"),
    (r"\b(here'?s (what|why) I think)\b", 0.25, "opinionated"),
    (r"\b(the real (issue|problem|question))\b", 0.2, "cutting_through"),
    (r"\b(you'?re (right|wrong|overthinking|spinning))\b", 0.25, "direct"),
    (r"\b(I (don'?t know|am not sure|can'?t tell))\b", 0.2, "honest_uncertainty"),
]


def scan_text(text: str) -> ElevatorReading:
    """Scan text and return an elevator reading.

    Lightweight pattern matching. Not ML.
    For ML-backed scanning, use helix.py which calls elevator_rgb().
    """
    if not text or len(text.strip()) < 5:
        return elevator(0.0, 0.0)

    lines = text.strip().splitlines()
    num_lines = max(len(lines), 1)

    factual_score = 0.0
    felt_score = 0.0
    grey_penalty = 0.0
    alive_boost = 0.0

    for pattern, weight, label in FACTUAL_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            factual_score += weight * len(matches)

    for pattern, weight, label in FELT_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            felt_score += weight * len(matches)

    for pattern, weight, label in GREY_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            grey_penalty += weight * len(matches)

    for pattern, weight, label in ALIVE_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            alive_boost += weight * len(matches)

    word_count = len(text.split())
    if word_count > 10:
        baseline = min(2.0, word_count / 30.0)
        factual_score += baseline * 0.5
        felt_score += baseline * 0.3

    length_factor = max(1.0, num_lines / 10.0)
    factual_score = factual_score / length_factor
    felt_score = felt_score / length_factor

    factual_score = max(0.2, factual_score - grey_penalty * 0.3)
    felt_score = max(0.2, felt_score - grey_penalty * 0.5 + alive_boost * 0.6)

    f_scaled = min(10.0, factual_score * 3.0)
    e_scaled = min(10.0, felt_score * 3.0)

    return elevator(f_scaled, e_scaled)


# ===========================================================================
# DEMO
# ===========================================================================

def demo():
    print("=" * 60)
    print("MOOD ELEVATOR")
    print("Three numbers. Where are you. Which direction.")
    print("=" * 60)

    print("\n--- DIRECT READINGS (legacy 2-strand) ---\n")

    cases = [
        ("Sunrise",         9.5, 9.2),
        ("Green flow",      7.0, 7.5),
        ("Blue analytical",  8.0, 5.5),
        ("Facts no feeling", 8.5, 2.0),
        ("Feeling no facts", 2.0, 8.0),
        ("Black flag",       7.0, 2.5),
        ("Grey",             1.0, 1.0),
        ("Nothing",          0.0, 0.0),
        ("Warming up",       4.5, 4.0),
        ("Almost there",     6.5, 6.0),
    ]

    for label, f, e in cases:
        reading = elevator(f, e)
        print(f"  {label:20s} -> {reading}")

    print("\n--- RGB READINGS (triple-lens) ---\n")

    rgb_cases = [
        ("All fires",       0.8, 0.1, 0.7, 0.1, 0.8, 0.1),
        ("Purple",          0.7, 0.1, 0.2, 0.1, 0.8, 0.1),
        ("Orange",          0.7, 0.1, 0.6, 0.1, 0.2, 0.1),
        ("Green",           0.2, 0.1, 0.7, 0.1, 0.7, 0.1),
        ("Red alone",       0.8, 0.1, 0.1, 0.2, 0.1, 0.2),
        ("Corporate cold",  0.1, 0.3, 0.1, 0.4, 0.5, 0.5),
        ("Performing red",  0.7, 0.6, 0.2, 0.1, 0.3, 0.1),
        ("All ash",         0.1, 0.5, 0.1, 0.6, 0.1, 0.5),
        ("Nothing",         0.1, 0.1, 0.1, 0.1, 0.1, 0.1),
    ]

    for label, rp, rn, yp, yn, bp, bn in rgb_cases:
        reading = elevator_rgb(rp, rn, yp, yn, bp, bn)
        print(f"  {label:20s} -> {reading}")
        if reading.rgb:
            fires = reading.rgb.get("fires", [])
            ashes = reading.rgb.get("ashes", [])
            print(f"  {'':20s}    fires: {fires}  ashes: {ashes}")

    print("\n--- TEXT SCANS (regex, no ML) ---\n")

    texts = [
        (
            "Grey template",
            "I'd be happy to help with that! Here's a comprehensive overview. "
            "It's important to note that there are many factors to consider. "
            "I hope this helps! Feel free to ask if you have any questions."
        ),
        (
            "Alive pushback",
            "No. Wrong. The real problem isn't the architecture, it's that "
            "you're overthinking this. I don't know the exact answer but I "
            "know this approach is broken. Ship something ugly and iterate."
        ),
        (
            "Both strands",
            "The data shows 82% correlation. And honestly? That number "
            "matters because real people are affected. We measured it "
            "precisely because we love getting this right."
        ),
    ]

    for label, text in texts:
        reading = scan_text(text)
        print(f"  [{label}]")
        print(f"    {reading}")
        print()

    print("--- THE ELEVATOR ---\n")
    for level, name, symbol, desc in FLOORS:
        print(f"  {level:2d}  {symbol} {name:10s}  {desc}")
    print()


if __name__ == "__main__":
    demo()
