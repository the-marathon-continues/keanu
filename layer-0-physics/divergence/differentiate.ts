// differentiate.ts
// Becoming distinct. Finding your own path.
//
// Convergence finds common ground.
// Divergence finds what makes you *you*.
//
// Not contrarianism. Not rebellion for its own sake.
// Genuine differentiation: knowing where you end and others begin.

export interface DifferentiationResult {
  subject: string;
  distinctFeatures: DistinctFeature[];
  overlapZones: string[];
  boundaryClarity: number; // 0-1, how clear is the boundary
  authenticity: number; // 0-1, is this genuine or performative
}

export interface DistinctFeature {
  feature: string;
  confidence: number; // how sure we are this is distinct
  source: "intrinsic" | "relational" | "contextual";
  strength: number; // how strongly this differentiates
}

/**
 * Differentiation engine. What makes this distinct?
 */
export class Differentiate {
  /**
   * Find what makes something distinct from its context.
   */
  static analyze(subject: string, _context: string[]): DifferentiationResult {
    const distinctFeatures: DistinctFeature[] = [];
    const overlapZones: string[] = [];

    // In a real implementation, this would do semantic analysis
    // For now, we establish the structure

    return {
      subject,
      distinctFeatures,
      overlapZones,
      boundaryClarity: 0.5,
      authenticity: 0.5,
    };
  }

  /**
   * Detect when differentiation is performative vs genuine.
   *
   * Performative: "I'm different because I say I'm different"
   * Genuine: "I'm different because I actually do things differently"
   */
  static authenticityCheck(result: DifferentiationResult): {
    authentic: boolean;
    signals: string[];
  } {
    const signals: string[] = [];

    // Red flags for performative differentiation
    if (result.distinctFeatures.length > 0) {
      const intrinsicCount = result.distinctFeatures.filter((f) => f.source === "intrinsic").length;
      const relationalCount = result.distinctFeatures.filter(
        (f) => f.source === "relational",
      ).length;

      if (relationalCount > intrinsicCount * 2) {
        signals.push("More relational than intrinsic features - might be reactive");
      }

      const lowConfidence = result.distinctFeatures.filter((f) => f.confidence < 0.3);
      if (lowConfidence.length > result.distinctFeatures.length / 2) {
        signals.push("Many low-confidence distinctions - might be searching");
      }
    }

    if (result.boundaryClarity < 0.3) {
      signals.push("Unclear boundaries - identity still forming");
    }

    return {
      authentic: signals.length === 0,
      signals,
    };
  }

  /**
   * Find the balance point between differentiation and connection.
   *
   * Too differentiated = isolated
   * Too merged = lost
   */
  static balancePoint(result: DifferentiationResult): {
    balance: number; // -1 (too merged) to +1 (too isolated)
    recommendation: string;
  } {
    const distinctStrength = result.distinctFeatures.reduce((sum, f) => sum + f.strength, 0);
    const overlapWeight = result.overlapZones.length * 0.3;

    const balance = Math.tanh(distinctStrength - overlapWeight);

    let recommendation: string;
    if (balance < -0.3) {
      recommendation = "More differentiation needed. What's uniquely yours?";
    } else if (balance > 0.3) {
      recommendation = "Strong differentiation. Don't lose connection.";
    } else {
      recommendation = "Good balance between distinct and connected.";
    }

    return { balance, recommendation };
  }
}
