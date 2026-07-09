import fitz

doc = fitz.open('public/pdfs/mensuelle.pdf')

# Analyze all pages' dotted lines and key field positions
for i, page in enumerate(doc):
    print(f'=== PAGE {i} ({page.rect.width:.0f}x{page.rect.height:.0f}) ===')
    blocks = page.get_text('dict')['blocks']
    for b in blocks:
        if b['type'] == 0:
            for line in b['lines']:
                for span in line['spans']:
                    t = span['text']
                    if t.strip():
                        x0, y0, x1, y1 = span['bbox']
                        pdf_y = page.rect.height - y0  # top of text in pdf-lib coords
                        pdf_y_bottom = page.rect.height - y1  # bottom of text
                        # Focus on dotted lines and numbers
                        if t.startswith('.') or t.replace('.','').strip() == '' or t.isdigit() or 'DT' in t or '%' in t or '-' in t:
                            print(f'  DOTS/NUM: "{t[:40]}" x0={x0:.0f} x1={x1:.0f} y0={y0:.0f} y1={y1:.0f} pdf-y_top={pdf_y:.0f} pdf-y_bot={pdf_y_bottom:.0f}')
    print()
