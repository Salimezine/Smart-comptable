import fitz

doc = fitz.open('public/pdfs/mensuelle.pdf')
print(f'Total pages: {doc.page_count}')
for i in range(doc.page_count):
    page = doc[i]
    text = page.get_text('text')
    # Print first 100 chars of text on each page
    clean = text.strip()[:200].replace('\n', ' | ')
    print(f'Page {i}: {clean}...')
    # Also check for table headers and key words
    keywords = ['TVA', 'tva', 'TFP', 'tfp', 'FOPROLOS', 'foprolos', 'TCL', 'tcl', 
                'timbre', 'Timbre', 'taxe', 'Taxe', 'hôtel', 'hotel',
                'licence', 'Licence', 'autre', 'Autre', 'total', 'Total']
    for kw in keywords:
        if kw in text:
            print(f'  -> Contains: "{kw}"')
    print()
