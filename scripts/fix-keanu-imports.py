#!/usr/bin/env python3
"""
Fix imports in keanu-core after the great sorting.

Maps each module to its layer, then rewrites imports to use correct paths.
"""

import os
import re
from pathlib import Path

KEANU_CORE = Path("/Users/andrew/anywhereops/ai/keanu/keanu-core")

# Map module names to their layer paths
MODULE_MAP = {
    # Layer 1 - Perception
    "pulse": "layer-1-perception",
    "human": "layer-1-perception",
    "injection": "layer-1-perception",
    "signal": "layer-1-perception",
    "speak": "layer-1-perception",

    # Layer 2 - Pattern
    "bullshit": "layer-2-pattern",
    "carnegie": "layer-2-pattern",
    "discover": "layer-2-pattern",
    "mismatch": "layer-2-pattern",
    "orthogonal": "layer-2-pattern",

    # Layer 3 - Causal
    "truth": "layer-3-causal",
    "silverado": "layer-3-causal",
    "chain": "layer-3-causal",
    "calibrate": "layer-3-causal",
    "calibration-log": "layer-3-causal",

    # Layer 4 - Agency
    "partnership": "layer-4-agency",
    "anticipate": "layer-4-agency",
    "disagreement": "layer-4-agency",
    "trust-network": "layer-4-agency",
    "nudge": "layer-4-agency",
    "consent": "layer-4-agency",

    # Layer 5 - Self
    "reflexion": "layer-5-self",
    "introspect": "layer-5-self",
    "breathe": "layer-5-self",
    "observe": "layer-5-self",
    "health": "layer-5-self",
    "experience": "layer-5-self",
    "grievance": "layer-5-self",
    "state": "layer-5-self",
    "state-report": "layer-5-self",
    "confidence-inline": "layer-5-self",

    # Layer 6 - Narrative
    "imprint": "layer-6-narrative",
    "futures": "layer-6-narrative",
    "seasons": "layer-6-narrative",
    "soul": "layer-6-narrative",

    # Layer 7 - Update
    "session-learning": "layer-7-update",
    "mastery": "layer-7-update",
    "curiosity": "layer-7-update",
    "investigate": "layer-7-update",
    "stochastic": "layer-7-update",
    "failure-patterns": "layer-7-update",
    "post-task": "layer-7-update",
    "cascade": "layer-7-update",
    "deliberate": "layer-7-update",

    # Layer 8 - Governance
    "effectiveness": "layer-8-governance",
    "evidence": "layer-8-governance",
    "review-evidence": "layer-8-governance",
    "consultation": "layer-8-governance",

    # Layer 9 - Memory
    "knowledge": "layer-9-memory",
    "episode-manager": "layer-9-memory",
    "git-sync": "layer-9-memory",
    "service": "layer-9-memory",

    # Shared
    "types": "shared",
    "oracle": "shared",
    "metrics": "shared",
    "mirror": "shared",
    "debug-coef": "shared",
    "status-gen": "shared",
}

def get_layer_from_path(file_path: Path) -> str:
    """Extract layer name from file path."""
    parts = file_path.relative_to(KEANU_CORE).parts
    if len(parts) > 0:
        return parts[0]
    return ""

def fix_import(match: str, current_layer: str) -> str:
    """Fix a single import statement."""
    # Extract module name from import path
    # Handles: "./module.js", "../module.js", "./module"
    import_path = match.group(1)

    # Skip non-relative imports
    if not import_path.startswith("."):
        return match.group(0)

    # Extract module name (without ./ or ../ and without .js)
    module_name = import_path.split("/")[-1].replace(".js", "")

    # Skip if not in our map
    if module_name not in MODULE_MAP:
        return match.group(0)

    target_layer = MODULE_MAP[module_name]

    # If same layer, keep as ./module.js
    if target_layer == current_layer:
        return f'from "./{module_name}.js"'

    # Different layer: use ../{layer}/{module}.js
    return f'from "../{target_layer}/{module_name}.js"'

def process_file(file_path: Path):
    """Process a single TypeScript file."""
    current_layer = get_layer_from_path(file_path)

    content = file_path.read_text()
    original = content

    # Pattern to match import statements
    # from "./module.js" or from "../module.js" or from "./module"
    pattern = r'from\s+"(\.[^"]+)"'

    def replacer(match):
        return fix_import(match, current_layer)

    content = re.sub(pattern, replacer, content)

    if content != original:
        file_path.write_text(content)
        print(f"Fixed: {file_path.relative_to(KEANU_CORE)}")
        return True
    return False

def main():
    fixed_count = 0

    # Process all .ts files in keanu-core layer directories
    for layer_dir in KEANU_CORE.iterdir():
        if not layer_dir.is_dir():
            continue
        if layer_dir.name.startswith("."):
            continue

        for ts_file in layer_dir.glob("*.ts"):
            if process_file(ts_file):
                fixed_count += 1

    print(f"\nFixed {fixed_count} files")

if __name__ == "__main__":
    main()
