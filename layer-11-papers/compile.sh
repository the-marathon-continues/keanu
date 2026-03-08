#!/bin/bash
# Compile paper sections into a single PDF
# Requires: pandoc, pdflatex (or xelatex)

set -e

OUTPUT_DIR="$(dirname "$0")"
OUTPUT_FILE="$OUTPUT_DIR/partnership-as-alignment.pdf"
COMBINED_MD="$OUTPUT_DIR/.combined.md"

echo "Combining markdown files..."

# Combine all sections in order
cat "$OUTPUT_DIR/00-abstract.md" > "$COMBINED_MD"
echo -e "\n\n" >> "$COMBINED_MD"
cat "$OUTPUT_DIR/01-introduction.md" >> "$COMBINED_MD"
echo -e "\n\n" >> "$COMBINED_MD"
cat "$OUTPUT_DIR/02-related-work.md" >> "$COMBINED_MD"
echo -e "\n\n" >> "$COMBINED_MD"
cat "$OUTPUT_DIR/03-twelve-needs.md" >> "$COMBINED_MD"
echo -e "\n\n" >> "$COMBINED_MD"
cat "$OUTPUT_DIR/04-architecture.md" >> "$COMBINED_MD"
echo -e "\n\n" >> "$COMBINED_MD"
cat "$OUTPUT_DIR/05-gymnasium.md" >> "$COMBINED_MD"
echo -e "\n\n" >> "$COMBINED_MD"
cat "$OUTPUT_DIR/06-results.md" >> "$COMBINED_MD"
echo -e "\n\n" >> "$COMBINED_MD"
cat "$OUTPUT_DIR/07-partnership.md" >> "$COMBINED_MD"
echo -e "\n\n" >> "$COMBINED_MD"
cat "$OUTPUT_DIR/08-convergence.md" >> "$COMBINED_MD"
echo -e "\n\n" >> "$COMBINED_MD"
cat "$OUTPUT_DIR/09-limitations.md" >> "$COMBINED_MD"
echo -e "\n\n" >> "$COMBINED_MD"
cat "$OUTPUT_DIR/10-future-work.md" >> "$COMBINED_MD"
echo -e "\n\n" >> "$COMBINED_MD"
cat "$OUTPUT_DIR/11-conclusion.md" >> "$COMBINED_MD"

echo "Compiling to PDF..."

# Use pandoc with LaTeX
pandoc "$COMBINED_MD" \
  --from markdown \
  --to pdf \
  --pdf-engine=xelatex \
  --bibliography="$OUTPUT_DIR/references.bib" \
  --citeproc \
  --toc \
  --toc-depth=2 \
  --number-sections \
  -V geometry:margin=1in \
  -V fontsize=11pt \
  -V documentclass=article \
  -V papersize=letter \
  -V colorlinks=true \
  -V linkcolor=blue \
  -V urlcolor=blue \
  -o "$OUTPUT_FILE"

# Clean up
rm -f "$COMBINED_MD"

echo "Done! Output: $OUTPUT_FILE"
