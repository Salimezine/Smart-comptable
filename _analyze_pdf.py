import fitz
doc = fitz.open('public/pdfs/mensuelle.pdf')
for i, page in enumerate(doc):
    blocks = page.get_text('dict')['blocks']
    print(f'=== PAGE {i} ({page.rect.width:.0f}x{page.rect.height:.0f}) ===')
    for b in blocks:
        if b['type'] == 0:
            for line in b['lines']:
                for span in line['spans']:
                    t = span['text'].strip()
                    if t:
                        x0, y0, x1, y1 = span['bbox']
                        pdf_y = page.rect.height - y1
                        print(f'  text={t[:30]:<30} font={span["font"]:20s} size={span["size"]:.1f} x0={x0:.0f} y0={y0:.0f} x1={x1:.0f} y1={y1:.0f} pdf-y~{pdf_y:.0f}')
