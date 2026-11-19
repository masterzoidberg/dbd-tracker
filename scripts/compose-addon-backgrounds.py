"""Rebuild selected Killer Add-on PNGs from transparent icons and rarity backgrounds.

Run `python scripts/compose-addon-backgrounds.py` after changing a rarity below.
Requires Pillow locally; the app build uses the resulting PNGs directly.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1] / "images" / "Powers and Add-ons"
RARITIES = {"common", "uncommon", "rare", "veryrare", "ultrarare"}
ADDONS = {
    ("Shape", "Fragrant Tuft of Hair"): "rare",
    ("Shape", "Reflective Fragment"): "veryrare",
}

for (killer, name), rarity in ADDONS.items():
    if rarity not in RARITIES:
        raise ValueError(f"Unknown rarity for {name}: {rarity}")
    background = Image.open(ROOT / f"Dbd-addons-{rarity}.png").convert("RGBA")
    foreground = Image.open(ROOT / killer / f"{name}.png").convert("RGBA")
    if background.size != foreground.size:
        raise ValueError(f"Background and icon sizes differ for {name}")
    output = ROOT / killer / "With Background" / f"{name}.png"
    Image.alpha_composite(background, foreground).save(output)
    print(f"{output.relative_to(ROOT)}: {rarity}")
