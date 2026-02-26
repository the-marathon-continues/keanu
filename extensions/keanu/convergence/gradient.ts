/**
 * Signal: A continuous value with history.
 * The atomic unit. Everything in the system is built on gradients, not booleans.
 * Strength 0.0 to 1.0. History tracks drift. Momentum tracks direction.
 */

export class Signal {
  strength: number;
  history: number[];

  constructor(strength: number = 0.5) {
    this.strength = clamp(strength);
    this.history = [this.strength];
  }

  push(value: number): void {
    this.strength = clamp(value);
    this.history.push(this.strength);
  }

  /** Direction of recent movement. Positive = toward pole_a, negative = toward pole_b. */
  get momentum(): number {
    if (this.history.length < 2) return 0;
    return this.history[this.history.length - 1] - this.history[this.history.length - 2];
  }

  /** How settled this signal is. 1 = stable, 0 = volatile. */
  get stability(): number {
    if (this.history.length < 3) return 0.5;
    const recent = this.history.slice(-5);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((a, x) => a + (x - mean) ** 2, 0) / recent.length;
    return Math.max(0, 1 - variance * 10);
  }

  /** How far from center. 0 = undecided, 1 = fully committed to a pole. */
  get conviction(): number {
    return Math.abs(this.strength - 0.5) * 2;
  }

  /** Which pole this leans toward. -1 = pole_b, 0 = center, 1 = pole_a. */
  get lean(): number {
    return (this.strength - 0.5) * 2;
  }

  toString(): string {
    const arrow = this.momentum > 0.01 ? "+" : this.momentum < -0.01 ? "-" : "=";
    return `${this.strength.toFixed(3)}${arrow}`;
  }

  toJSON(): { strength: number; history: number[] } {
    return { strength: this.strength, history: this.history };
  }

  static fromJSON(data: { strength: number; history: number[] }): Signal {
    const s = new Signal(data.strength);
    s.history = data.history;
    return s;
  }
}

export function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}
