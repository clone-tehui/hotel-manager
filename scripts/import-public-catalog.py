"""Read the supplied price workbook; generate public-only presentation data.

Does not modify the workbook, reservations, room prices or the database.
"""
import concurrent.futures
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
CODE = re.compile(r"\b([ABC])0*(\d{1,2})([AB]?)\.(\d{2})([AB]?)\b", re.I)


def canonical(value):
    match = CODE.search(value)
    if match:
        prefix, floor, floor_suffix, unit, suffix = match.groups()
        return f"{prefix.upper()}{int(floor)}{floor_suffix.upper()}.{unit}{suffix.upper()}"
    return "VIC29" if re.search(r"vic\s*29", value, re.I) else None


def load_rows(path):
    sheet = openpyxl.load_workbook(path, data_only=True).active
    records = []
    building, room_type = "OPERA", None
    for row in sheet:
        heading = str(row[0].value or "").strip()
        if re.fullmatch(r"[1-5]PN", heading):
            room_type = heading
        for label in (heading, str(row[1].value or "")):
            if not canonical(label):
                for key in ("OPERA", "GALLERIA", "CREST"):
                    if key in label.upper():
                        building = key
        name = str(row[1].value or "").strip()
        key = canonical(name)
        if not key:
            continue
        description = str(row[2].value or "").strip()
        combined = f"{name} {description}".upper()
        explicit_building = next((b for b in ("OPERA", "GALLERIA", "CREST") if b in combined), None)
        actual_building = explicit_building or building
        if "LANCASTER" in combined:
            actual_building = "KHAC"
        if key == "VIC29":
            actual_building = "VIC29"
        price_match = re.search(r"giá\s*(?:giá\s*)?([\d]+(?:\.[\d]{3})+)", description, re.I)
        price = int(price_match.group(1).replace(".", "")) if price_match else None
        if key == "VIC29" and "12tr" in description.lower():
            price = 12000000
        links = re.findall(r"https://(?:photos\.app\.goo\.gl|photos\.google\.com)/[^\s]+", description)
        link_cell = row[3]
        album = (link_cell.hyperlink.target if link_cell.hyperlink else str(link_cell.value or "").strip()) or (links[0] if links else None)
        if album and not album.startswith(("https://photos.app.goo.gl/", "https://photos.google.com/")):
            raise ValueError(f"Unexpected album URL at row {row[0].row}")
        description = re.sub(r"https://\S+", "", description).strip()
        description = re.sub(r"^Dạ căn\s*", "", description, flags=re.I).strip()
        view = re.search(r"view\s+(.+?)(?:\s+giá|$)", description, re.I | re.S)
        records.append({"key": f"{actual_building}:{key}", "roomCode": CODE.search(name).group(0).upper() if CODE.search(name) else "Vic29",
                        "buildingCode": actual_building, "roomType": room_type if key != "VIC29" else "Biệt thự",
                        "nightlyPrice": price, "description": description,
                        "view": view.group(1).strip(" ,\\\n") if view else None,
                        "albumUrl": album, "images": [], "coverImage": None,
                        "sourceRow": row[0].row})
    keys = [r["key"] for r in records]
    if len(keys) != len(set(keys)):
        raise ValueError("Duplicate room keys in workbook")
    return records


def hourly_rates(path):
    sheet = openpyxl.load_workbook(path, data_only=True).active
    rates = []
    for row in sheet:
        description = str(row[2].value or "").strip()
        if canonical(str(row[1].value or "")):
            continue
        match = re.search(r"giá\s*([\d]+(?:\.[\d]{3})+)\s*/\s*1\s*giờ", description, re.I)
        if match:
            rates.append({"description": description[:match.start()].strip(), "hourlyPrice": int(match.group(1).replace(".", "")), "sourceRow": row[0].row})
    return rates


def fetch_album(record):
    url = record["albumUrl"]
    if not url:
        return record, "missing album"
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request, timeout=30) as response:
            markup = response.read().decode("utf-8")
        title_match = re.search(r'<meta property="og:title" content="([^"]+)"', markup)
        title = html.unescape(title_match.group(1)) if title_match else ""
        record["albumTitle"] = title
        title_key = canonical(title)
        # User previously confirmed C05.03A is the same apartment as C05.03.
        if record["key"] == "GALLERIA:C5.03" and title_key == "C5.03A":
            title_key = "C5.03"
        if title_key and title_key != record["key"].split(":", 1)[1]:
            record["albumMismatch"] = True
            return record, f"ALBUM MISMATCH: {title}"
        image_match = re.search(r'<meta property="og:image" content="([^"]+)"', markup)
        if not image_match:
            return record, "album unavailable or requires login"
        cover = html.unescape(image_match.group(1))
        if not cover.startswith("https://lh3.googleusercontent.com/pw/"):
            return record, "no apartment cover"
        images = list(dict.fromkeys(re.findall(r"https://lh3\.googleusercontent\.com/pw/[A-Za-z0-9_-]+", markup)))
        record["images"] = [u + "=w1400" for u in images]
        cover_url = cover.split("=", 1)[0] + "=w1200"
        with urllib.request.urlopen(urllib.request.Request(cover_url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as response:
            if not response.headers.get("Content-Type", "").startswith("image/"):
                raise ValueError("Cover response is not an image")
            data = response.read()
        filename = record["key"].replace(":", "-").replace(".", "-") + ".jpg"
        directory = ROOT / "apps/web/public/apartment-photos"
        directory.mkdir(parents=True, exist_ok=True)
        (directory / filename).write_bytes(data)
        record["coverImage"] = "/apartment-photos/" + filename
        record.pop("albumMismatch", None)
        record.pop("albumUnavailable", None)
        return record, f"OK ({len(images)} photos)"
    except Exception as error:
        record["albumUnavailable"] = True
        return record, str(error)


if __name__ == "__main__":
    destination = ROOT / "apps/web/src/app/kiem-tra-phong/catalog.json"
    overrides_path = ROOT / "scripts/public-album-overrides.json"
    overrides = json.loads(overrides_path.read_text()) if overrides_path.exists() else {}
    update_only = sys.argv[1] == "--update-albums"
    existing = json.loads(destination.read_text()) if update_only else None
    rows = [r for r in existing["rooms"] if r["key"] in overrides] if existing else load_rows(sys.argv[1])
    for record in rows:
        if record["key"] in overrides:
            if record["albumUrl"] != overrides[record["key"]]:
                record["coverImage"] = None
                record["galleryUrl"] = None
                record["imageCount"] = 0
            record["albumUrl"] = overrides[record["key"]]
            record.pop("albumMismatch", None)
            record.pop("albumTitle", None)
        record["images"] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(fetch_album, rows))
    for record, status in results:
        print(f'{record["sourceRow"]}: {record["key"]} price={record["nightlyPrice"]} {status}', flush=True)
    for record, _ in results:
        images = record.pop("images")
        record["imageCount"] = len(images)
        record["galleryUrl"] = None
        if images:
            filename = record["key"].replace(":", "-").replace(".", "-") + ".json"
            (ROOT / "apps/web/public/apartment-photos" / filename).write_text(json.dumps(images) + "\n")
            record["galleryUrl"] = "/apartment-photos/" + filename
    destination.parent.mkdir(parents=True, exist_ok=True)
    output = existing or {"source": "Bảng giá Metropole.xlsx", "rooms": [r for r, _ in results], "hourlyRates": hourly_rates(sys.argv[1])}
    destination.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(f"Imported {len(rows)} rooms; {sum(bool(r['coverImage']) for r, _ in results)} covers")
