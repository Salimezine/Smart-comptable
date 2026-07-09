#!/usr/bin/env python3
"""
Crawl4AI fiscal data scraper for Smart Comptable.
Scrapes:
  1. Tunisian tax rates / deadlines (impots.finances.gov.tn)
  2. Competitor feature matrices (Axiane, etc.)
  3. Outputs structured JSON consumed by the JS app
"""

import argparse
import json
import os
import sys
from datetime import date

from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode

# ── Config ──────────────────────────────────────────────────────────────
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'data')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Sources ─────────────────────────────────────────────────────────────
SOURCES = {
    'impots': {
        'url': 'https://www.impots.finances.gov.tn',
        'label': 'Portail Fiscal Tunisien',
    },
    'wikipedia_fiscalite': {
        'url': 'https://fr.wikipedia.org/wiki/Fiscalit%C3%A9_en_Tunisie',
        'label': 'Wikipedia - Fiscalité Tunisienne',
    },
    'wikipedia_tva': {
        'url': 'https://fr.wikipedia.org/wiki/Taxe_sur_la_valeur_ajout%C3%A9e_en_Tunisie',
        'label': 'Wikipedia - TVA Tunisie',
    },
    'axiane': {
        'url': 'https://www.axiane.tn',
        'label': 'Axiane Tunisie',
    },
    # Add more sources here
}


async def crawl_url(url, label, output_key):
    """Crawl a single URL and save markdown + structured data."""
    config = CrawlerRunConfig(
        cache_mode=CacheMode.ENABLED,
        page_timeout=30000,
        remove_overlay_elements=True,
        verbose=True,
    )
    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(url, config=config)
        if not result.success:
            print(f"  ❌ {label}: failed")
            return None

        # Save raw markdown
        md_path = os.path.join(OUTPUT_DIR, f'{output_key}.md')
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(result.markdown)
        print(f"  ✅ {label}: {len(result.markdown)} chars → {output_key}.md")

        # Extract links for further crawling
        links = {
            'internal': [l for l in (result.links.get('internal') or []) if l.get('href')],
            'external': [l for l in (result.links.get('external') or []) if l.get('href')],
        }
        meta = {
            'title': result.metadata.get('title', ''),
            'description': result.metadata.get('description', ''),
            'url': url,
            'crawled_at': date.today().isoformat(),
            'markdown_length': len(result.markdown),
            'links_found': len(links['internal']) + len(links['external']),
            'links': {k: [lk['href'] for lk in v][:20] for k, v in links.items()},
        }
        meta_path = os.path.join(OUTPUT_DIR, f'{output_key}_meta.json')
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
        print(f"  📄 Meta saved → {output_key}_meta.json")

        # Extract structured fiscal data from markdown
        fiscal = extract_fiscal_data(result.markdown, output_key)
        if fiscal:
            fiscal_path = os.path.join(OUTPUT_DIR, f'{output_key}_fiscal.json')
            with open(fiscal_path, 'w', encoding='utf-8') as f:
                json.dump(fiscal, f, ensure_ascii=False, indent=2)
            print(f"  📊 Fiscal data extracted → {output_key}_fiscal.json")

        return result


def extract_fiscal_data(markdown, source_key):
    """Extract structured tax rates, deadlines, and rules from scraped markdown."""
    import re

    data = {
        'source': source_key,
        'crawled_at': date.today().isoformat(),
        'taux': {},
        'echeances': [],
        'lois': [],
        'informations': [],
    }

    lines = markdown.split('\n')
    text = ' '.join(lines)

    # TVA rates
    tva_patterns = [
        (r'TVA\s*[àa]\s*(19\s*%|19[.,]\s*00\s*%)', '19%', 'Taux normal TVA'),
        (r'TVA\s*(19\s*%|19[.,]\s*00\s*%)', '19%', 'Taux normal TVA'),
        (r'(7\s*%)\s*(?:TVA|tva)', '7%', 'Taux réduit TVA'),
        (r'(13\s*%)\s*(?:TVA|tva)', '13%', 'Taux TVA hôtellerie'),
        (r'(taux|taux de)\s*(?:réduit|reduit)\s*(?:de\s*)?(7\s*%)', '7%', 'Taux réduit TVA'),
    ]
    for pat, taux, label in tva_patterns:
        if re.search(pat, text):
            data['taux'][f'tva_{taux.replace("%","").strip()}'] = {
                'taux': taux.strip(),
                'label': label,
                'type': 'tva',
            }

    # IS rates
    is_patterns = [
        (r'imp[ôo]t\s*(?:sur\s*)?(?:les\s*)?soci[ée]t[ée]s?.*?(15\s*%|25\s*%|35\s*%|40\s*%)', 'IS'),
    ]
    for pat in is_patterns:
        m = re.search(pat[0], text)
        if m:
            data['taux']['is_' + m.group(1).replace('%', '').strip()] = {
                'taux': m.group(1).strip(),
                'label': 'Impôt sur les Sociétés',
                'type': 'is',
            }

    # IRPP
    if re.search(r'IRPP|imp[ôo]t\s*revenu|bareme.*irpp', text):
        data['taux']['irpp'] = {
            'taux': '0-40%',
            'label': 'Barème IRPP (tranches 0%, 15%, 25%, 30%, 33%, 36%, 38%, 40%)',
            'type': 'irpp',
        }

    # RS rates
    rs_matches = re.findall(r'(?:retenue|retenues?|rs).*?(\d[\d.,]*\s*%)', text)
    if rs_matches:
        data['taux']['rs'] = {
            'taux': ', '.join(rs_matches[:5]),
            'label': 'Retenues à la source',
            'type': 'rs',
        }

    # TFP / FOPROLOS
    if re.search(r'tfp|foprolos|formation.*professionnelle', text):
        data['taux']['tfp'] = {
            'taux': '1% salaires + 1% employeur',
            'label': 'Taxe Formation Professionnelle + FOPROLOS',
            'type': 'tfp',
        }

    # TCL
    if re.search(r'tcl|taxe.*collectivit[ée]s?.*locale', text):
        data['taux']['tcl'] = {
            'taux': '10% TVA due',
            'label': 'Taxe Collectivités Locales',
            'type': 'tcl',
        }

    # CNSS
    if re.search(r'cnss|caisse.*s[ée]curit[ée]|s[ée]curit[ée]\s*sociale', text):
        data['taux']['cnss'] = {
            'taux': '13.57% salarial + 16.57% patronal',
            'label': 'Cotisations CNSS',
            'type': 'cnss',
        }

    # Dates / échéances
    date_patterns = [
        (r'(\d{1,2})\s*(?:er|janvier|janv)[^a-z]*?(\d{4})', 'Janvier'),
        (r'(\d{1,2})\s*(?:f[ée]vrier|fev)[^a-z]*?(\d{4})', 'Février'),
        (r'(\d{1,2})\s*mars[^a-z]*?(\d{4})', 'Mars'),
    ]
    # Look for deadline mentions
    if re.search(r'(?:date|échéance|declaration|délai|limite|avant|au plus tard).*?(15|20|25|30|31)\s*(?:du mois|jours|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)', text):
        data['echeances'].append({
            'type': 'tva',
            'defaut': '20 du mois suivant',
            'source': text[:500],
        })

    # Laws / articles
    for law_num in range(1, 100):
        if re.search(rf'article\s+{law_num}|loi\s+n[°o]\s*{law_num}', text):
            data['lois'].append({
                'article': str(law_num),
                'extrait': text[:300],
            })

    # General info (first meaningful paragraph)
    for line in lines:
        clean = line.strip()
        if len(clean) > 80 and any(kw in clean.lower() for kw in ['tva', 'impôt', 'impot', 'fiscal', 'déclaration', 'taxe']):
            data['informations'].append(clean[:500])
            if len(data['informations']) >= 5:
                break

    return data


async def crawl_competitor_features(url, label, output_key):
    """
    Crawl a competitor site (e.g. Axiane) and extract feature descriptions
    from their product/pricing pages.
    """
    config = CrawlerRunConfig(
        cache_mode=CacheMode.ENABLED,
        page_timeout=30000,
        remove_overlay_elements=True,
    )
    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(url, config=config)
        if not result.success:
            return None

        # Extract relevant links (product, features, pricing)
        all_links = []
        for link in (result.links.get('internal') or []):
            href = link.get('href', '')
            text = (link.get('text') or '').lower()
            if any(kw in href.lower() or kw in text for kw in
                   ['produit', 'fonctionnalite', 'feature', 'pricing',
                    'tarif', 'solution', 'module', 'avantage']):
                all_links.append(href)

        # Crawl each relevant sub-page
        features = {}
        for sub_url in set(all_links[:10]):  # max 10 sub-pages
            full_url = sub_url if sub_url.startswith('http') else url.rstrip('/') + '/' + sub_url.lstrip('/')
            try:
                sub = await crawler.arun(full_url, config=config)
                if sub.success:
                    features[full_url] = sub.markdown[:3000]
                    print(f"    ↳ {len(sub.markdown)} chars from {full_url}")
            except Exception:
                pass

        data = {
            'source': label,
            'url': url,
            'crawled_at': date.today().isoformat(),
            'home_page_markdown': result.markdown[:5000],
            'features': features,
        }
        path = os.path.join(OUTPUT_DIR, f'{output_key}_features.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  📦 Features saved → {output_key}_features.json")
        return data


def scrape_wikipedia_fallback(output_key, url, label):
    """Fallback scraper using requests+BeautifulSoup for Wikipedia pages."""
    try:
        import requests
        from bs4 import BeautifulSoup
        headers = {'User-Agent': 'SmartComptable/1.0 (fiscal data collector)'}
        resp = requests.get(url, headers=headers, timeout=20)
        if resp.status_code != 200:
            print(f"  ⚠️ {label}: HTTP {resp.status_code}")
            return False

        soup = BeautifulSoup(resp.text, 'html.parser')
        # Remove unwanted elements
        for el in soup(['script', 'style', 'nav', 'footer', 'header']):
            el.decompose()

        content = soup.find('div', {'id': 'mw-content-text'}) or soup.find('div', {'class': 'mw-content-ltr'}) or soup
        text = content.get_text(separator='\n', strip=True)

        # Save markdown
        md_path = os.path.join(OUTPUT_DIR, f'{output_key}.md')
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"  ✅ {label}: {len(text)} chars → {output_key}.md")

        # Extract fiscal data
        fiscal = extract_fiscal_data(text, output_key)
        fiscal_path = os.path.join(OUTPUT_DIR, f'{output_key}_fiscal.json')
        with open(fiscal_path, 'w', encoding='utf-8') as f:
            json.dump(fiscal, f, ensure_ascii=False, indent=2)
        print(f"  📊 Fiscal data extracted → {output_key}_fiscal.json")

        # Save meta
        meta = {
            'title': soup.title.string if soup.title else label,
            'description': '',
            'url': url,
            'crawled_at': date.today().isoformat(),
            'markdown_length': len(text),
            'method': 'requests+bs4',
        }
        meta_path = os.path.join(OUTPUT_DIR, f'{output_key}_meta.json')
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
        print(f"  📄 Meta saved → {output_key}_meta.json")
        return True
    except Exception as e:
        print(f"  ⚠️ Wikipedia fallback failed: {e}")
        return False


def generate_fallback_fiscal():
    """Generate default fiscal data so the app always has something."""
    data = {
        'generated_at': date.today().isoformat(),
        'taux': {
            'tva_19': {'taux': '19%', 'label': 'TVA taux normal', 'type': 'tva'},
            'tva_7': {'taux': '7%', 'label': 'TVA taux réduit (transport, agriculture, santé)', 'type': 'tva'},
            'tva_13': {'taux': '13%', 'label': 'TVA hôtellerie, restauration, tourisme', 'type': 'tva'},
            'is_25': {'taux': '25%', 'label': 'IS taux commun', 'type': 'is'},
            'is_15': {'taux': '15%', 'label': 'IS industrie/export', 'type': 'is'},
            'is_10': {'taux': '10%', 'label': 'IS agriculture', 'type': 'is'},
            'irpp': {'taux': '0-40%', 'label': 'Barème IRPP (tranches 0%, 15%, 25%, 30%, 33%, 36%, 38%, 40%)', 'type': 'irpp'},
            'rs': {'taux': '1.5% à 15%', 'label': 'Retenues à la source (honoraires, loyers, prestations)', 'type': 'rs'},
            'tfp': {'taux': '1% salaires + 1% employeur', 'label': 'Taxe Formation Professionnelle + FOPROLOS', 'type': 'tfp'},
            'tcl': {'taux': '10% TVA due', 'label': 'Taxe Collectivités Locales', 'type': 'tcl'},
            'cnss': {'taux': '13.57% salarial + 16.57% patronal', 'label': 'Cotisations CNSS', 'type': 'cnss'},
        },
        'echeances': [
            {'type': 'tva', 'defaut': '15 du mois suivant'},
            {'type': 'is', 'defaut': '25 juin/septembre/décembre (acomptes), 31 mars (solde)'},
            {'type': 'rs', 'defaut': '15 du mois suivant'},
            {'type': 'cnss', 'defaut': '15 du mois suivant'},
        ],
        'informations': [
            'La TVA en Tunisie est de 19% (taux normal), 7% (réduit) et 13% (hôtellerie). La déclaration est mensuelle ou trimestrielle.',
            'L\'Impôt sur les Sociétés (IS) est de 25% pour le taux commun, 15% pour l\'industrie/export, 10% pour l\'agriculture.',
            'L\'IRPP est calculé par tranches: 0% jusqu\'à 5000 DT, puis 15%, 25%, 30%, 33%, 36%, 38%, 40% au-delà de 70000 DT.',
            'Les retenues à la source (RS) varient de 1.5% à 15% selon le type de prestation.',
            'La TFP (1% salaires) et FOPROLOS (1% employeur) sont dus mensuellement par tout employeur.',
        ],
    }
    path = os.path.join(OUTPUT_DIR, '_fallback_fiscal.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  📋 Fallback fiscal data → _fallback_fiscal.json")
    return data


async def main():
    parser = argparse.ArgumentParser(description='Smart Comptable Fiscal Scraper')
    parser.add_argument('--source', choices=list(SOURCES.keys()) + ['all'],
                        default='all', help='Source to scrape')
    parser.add_argument('--features', action='store_true',
                        help='Deep-crawl competitor feature pages')
    parser.add_argument('--url', type=str, help='Custom URL to scrape')
    parser.add_argument('--label', type=str, default='custom',
                        help='Label for custom URL')
    parser.add_argument('--list', action='store_true',
                        help='List available sources')
    args = parser.parse_args()

    if args.list:
        print("Available sources:")
        for k, v in SOURCES.items():
            print(f"  {k}: {v['url']} ({v['label']})")
        return

    if args.url:
        print(f"\n🔍 Crawling custom URL: {args.url}")
        if args.features:
            await crawl_competitor_features(args.url, args.label, args.label)
        else:
            await crawl_url(args.url, args.label, args.label)
        return

    targets = list(SOURCES.items()) if args.source == 'all' else [(args.source, SOURCES[args.source])]

    for key, info in targets:
        print(f"\n🔍 Crawling {key} → {info['url']}")
        if args.features:
            await crawl_competitor_features(info['url'], info['label'], key)
        else:
            result = await crawl_url(info['url'], info['label'], key)
            # If crawl4ai returned too little data (likely blocked), try Wikipedia fallback
            if (result is None or len(result.markdown.strip()) < 100) and 'wikipedia' in info['url']:
                print(f"  ↳ crawl4ai returned {len(result.markdown.strip()) if result else 0} chars, trying requests+BS4 fallback...")
                scrape_wikipedia_fallback(key, info['url'], info['label'])

    # Always generate fallback fiscal data (ensures app always has baseline rates)
    generate_fallback_fiscal()

    # Generate a combined index
    index = {
        'generated_at': date.today().isoformat(),
        'sources': {k: {'url': v['url'], 'label': v['label']} for k, v in SOURCES.items()},
        'output_dir': OUTPUT_DIR,
    }
    idx_path = os.path.join(OUTPUT_DIR, 'scrape_index.json')
    with open(idx_path, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    print(f"\n📋 Index → {idx_path}")
    print("Done.")


if __name__ == '__main__':
    import asyncio
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    asyncio.run(main())
