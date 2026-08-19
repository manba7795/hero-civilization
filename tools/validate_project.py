from pathlib import Path
import json, re, sys

ROOT = Path(__file__).resolve().parents[1]
errors = []

for path in ROOT.rglob("*.json"):
    if "node_modules" in path.parts:
        continue
    try:
        json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"JSON: {path.relative_to(ROOT)} -> {exc}")

for path in (ROOT / "src").rglob("*.ts"):
    text = path.read_text(encoding="utf-8")
    for spec in re.findall(r'from\s+["\']([^"\']+)["\']', text):
        if not spec.startswith("."):
            continue
        base = path.parent / spec
        choices = [base, Path(str(base) + ".ts"), Path(str(base) + ".json"), base / "index.ts"]
        if not any(p.exists() for p in choices):
            errors.append(f"IMPORT: {path.relative_to(ROOT)} -> {spec}")

for rel in ["heroes.json", "artifacts.json", "pokemon.json", "nations.json", "leaders.json"]:
    a = json.loads((ROOT / "data" / rel).read_text(encoding="utf-8"))
    b = json.loads((ROOT / "src" / "data" / rel).read_text(encoding="utf-8"))
    if a != b:
        errors.append(f"DATA MIRROR: data/{rel} != src/data/{rel}")

print(f"project validation: {len(errors)} error(s)")
for err in errors:
    print(" -", err)
sys.exit(1 if errors else 0)
