import fitz
import sys

doc = fitz.open('public/pdfs/mensuelle.pdf')

HARDCODED = {
    1: (0, 436), 2: (0, 409), 3: (0, 381), 4: (0, 328), '4b': (0, 313),
    5: (1, 679), 6: (1, 661), 7: (1, 644), 8: (1, 628), 9: (1, 610),
    10: (1, 593), 11: (1, 569), 12: (1, 544), 13: (1, 526), 14: (1, 509),
    15: (1, 493), 16: (1, 475), 17: (1, 458), 18: (1, 442), 19: (1, 418),
    20: (1, 388), 21: (2, 658), 22: (2, 610), 23: (2, 579), 24: (2, 554),
    25: (2, 515), 26: (2, 470), 27: (2, 432), 28: (2, 401), 29: (2, 381),
    30: (2, 361), 31: (3, 544)
}

with open('_position_comparison.txt', 'w', encoding='utf-8') as f:
    # First find all dotted y-levels per page
    for page_idx in range(4):
        page = doc[page_idx]
        h = page.rect.height
        blocks = page.get_text('dict')['blocks']
        
        f.write(f'\n=== Page {page_idx} ===\n')
        dot_lines = {}
        
        for b in blocks:
            if b['type'] != 0:
                continue
            for line in b['lines']:
                for span in line['spans']:
                    t = span['text'].strip()
                    if not t:
                        continue
                    x0, y0, x1, y1 = span['bbox']
                    if t.startswith('.') and t.replace('.', '').strip() == '':
                        pdf_y_top = h - y0
                        pdf_y_bot = h - y1
                        y_center = (pdf_y_top + pdf_y_bot) / 2
                        
                        if 30 < x0 < 100:
                            col = 'amount'
                        elif 230 < x0 < 310:
                            col = 'base'
                        else:
                            col = f'x={x0:.0f}'
                        
                        key = round(y_center)
                        if key not in dot_lines:
                            dot_lines[key] = {}
                        dot_lines[key][col] = f'{pdf_y_top:.0f}-{pdf_y_bot:.0f}'
        
        f.write(f'  Found {len(dot_lines)} y-levels with fillable dots:\n')
        for yc in sorted(dot_lines.keys(), reverse=True):
            f.write(f'    y~{yc}: {dot_lines[yc]}\n')

    # Comparison
    f.write('\n\n=== COMPARISON ===\n')
    for line_num, (h_page, h_y) in sorted(HARDCODED.items(), key=lambda x: (x[1][0], -x[1][1])):
        page = doc[h_page]
        h = page.rect.height
        blocks = page.get_text('dict')['blocks']
        nearest = None
        min_dist = 999
        
        for b in blocks:
            if b['type'] != 0:
                continue
            for line in b['lines']:
                for span in line['spans']:
                    t = span['text'].strip()
                    if not t or not t.startswith('.'):
                        continue
                    x0, y0, x1, y1 = span['bbox']
                    if not (30 < x0 < 100):
                        continue
                    if t.replace('.', '').strip() != '':
                        continue
                    pdf_y = h - y1
                    dist = abs(pdf_y - h_y)
                    if dist < min_dist:
                        min_dist = dist
                        nearest = pdf_y
        
        if nearest is not None:
            status = 'OK' if min_dist < 5 else 'WARN' if min_dist < 15 else 'MISMATCH'
        else:
            status = 'NOT FOUND'
        
        f.write(f'  Line {str(line_num):>3}: page={h_page} y={h_y:.0f} -> nearest amount dots y~{nearest if nearest else -1} (delta={min_dist}) {status}\n')

print('Done. Check _position_comparison.txt')
