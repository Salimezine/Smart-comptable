import fitz
import sys

doc = fitz.open('public/pdfs/mensuelle.pdf')

# Save text with safe encoding
with open('_pdf_analysis.txt', 'w', encoding='utf-8') as f:
    for i, page in enumerate(doc):
        f.write(f'=== PAGE {i} ({page.rect.width:.0f}x{page.rect.height:.0f}) ===\n')
        blocks = page.get_text('dict')['blocks']
        for b in blocks:
            if b['type'] == 0:  # text
                for line in b['lines']:
                    for span in line['spans']:
                        t = span['text'].strip()
                        if t:
                            x0, y0, x1, y1 = span['bbox']
                            pdf_y = page.rect.height - y1
                            f.write(f'  text="{t}" font={span["font"]} size={span["size"]:.1f} x0={x0:.0f} y0={y0:.0f} x1={x1:.0f} y1={y1:.0f} pdf-y~{pdf_y:.0f}\n')
            elif b['type'] == 1:  # image
                f.write(f'  [IMAGE] {b["width"]}x{b["height"]} at ({b["bbox"]})\n')

# Also extract and analyze graphical elements
with open('_pdf_graphics.txt', 'w', encoding='utf-8') as f:
    for i, page in enumerate(doc):
        f.write(f'=== PAGE {i} GRAPHICS ===\n')
        paths = page.get_drawings()
        for p in paths:
            items = p.get('items', [])
            for item in items:
                f.write(f'  {item}\n')

print("Done. Check _pdf_analysis.txt and _pdf_graphics.txt")
