# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""Downloads the demos' 3D files and the robot game listed in assets/assets.json into assets/, checking each
file's size and SHA-256. Files already present and correct are skipped. Python 3.9 or newer, standard library only.

    python3 scripts/fetch_assets.py [--base-url <address>]     (or: uv run scripts/fetch_assets.py)
"""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

ASSETS_DIR = Path(__file__).resolve().parent.parent / 'assets'


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch_one(url: str, target: Path, entry: dict) -> str:
    """Downloads one file unless it's already there and correct. Returns 'ok' or 'fetched'; raises on failure."""
    if target.exists() and sha256(target.read_bytes()) == entry['sha256']:
        return 'ok'
    # A named User-Agent: the asset host's bot check rejects Python's default "Python-urllib" one (error 1010).
    request = urllib.request.Request(url, headers={'User-Agent': 'fetch_assets.py'})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read()
    if len(data) != entry['bytes'] or sha256(data) != entry['sha256']:
        raise ValueError(f'{url} does not match assets.json')
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_name(target.name + '.part')
    partial.write_bytes(data)
    partial.replace(target)
    return 'fetched'


def main() -> int:
    listing = json.loads((ASSETS_DIR / 'assets.json').read_text())
    base_url = listing['base_url']
    if '--base-url' in sys.argv:
        base_url = sys.argv[sys.argv.index('--base-url') + 1]
    base_url = base_url.rstrip('/')

    # Every download as one item: a single file, or a folder (a page plus the files it loads) as a group.
    items = [{'name': e['name'], 'bytes': e['bytes'], 'parts': [(f"{base_url}/{e['path']}", ASSETS_DIR / e['name'], e)]}
             for e in listing['files']]
    items += [{'name': f"{f['name']}/ ({len(f['files'])} files)", 'bytes': f['bytes'],
               'parts': [(f"{base_url}/{f['path']}/{e['path']}", ASSETS_DIR / f['name'] / e['path'], e) for e in f['files']]}
              for f in listing.get('folders', [])]

    failures = 0
    for item in items:
        megabytes = f"{item['bytes'] / 1e6:.1f}"
        try:
            results = [fetch_one(url, target, entry) for url, target, entry in item['parts']]
            if 'fetched' in results:
                print(f"fetched  {item['name']} ({megabytes} MB)")
            else:
                print(f"ok       {item['name']} ({megabytes} MB, already here)")
        except Exception as error:  # report every item, then fail once at the end
            failures += 1
            print(f"FAILED   {item['name']}: {error}", file=sys.stderr)

    if failures:
        print(f'\n{failures} of {len(items)} downloads failed.', file=sys.stderr)
        return 1
    print('\nEverything is in assets/.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
