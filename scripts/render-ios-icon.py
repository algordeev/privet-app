# /// script
# requires-python = ">=3.10"
# dependencies = ["resvg-py==0.5.0", "Pillow==13.0.0"]
# ///
"""Render the Privet vector as an opaque app icon. Run: uv run scripts/render-ios-icon.py"""
from io import BytesIO
import json
from pathlib import Path
import xml.etree.ElementTree as ET

from PIL import Image
from resvg_py import svg_to_bytes

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/brand/ios-app-icon.svg"
CATALOG = ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset"


def render():
    svg = ET.parse(SOURCE).getroot()
    favicon = ET.parse(ROOT / "public/icon.svg").getroot()
    # Guard the logo geometry/colors: only scale, positioning and canvas differ.
    original = [(node.tag, node.attrib) for node in list(favicon)[1:]]
    symbol = [(node.tag, node.attrib) for node in svg.find("{http://www.w3.org/2000/svg}g")]
    assert symbol == original, "Keep the icon symbol identical to the existing Privet favicon."
    canvas = svg.find("{http://www.w3.org/2000/svg}rect")
    assert canvas is not None and canvas.attrib == {"width": "64", "height": "64", "fill": "#f8f6f0"}
    entries = json.loads((CATALOG / "Contents.json").read_text())["images"]
    assert len(entries) == 1 and entries[0]["size"] == "1024x1024"
    assert entries[0]["idiom"] == "universal" and entries[0]["platform"] == "ios"
    output = CATALOG / entries[0]["filename"]
    raster = Image.open(BytesIO(svg_to_bytes(svg_path=str(SOURCE), width=1024, height=1024, skip_system_fonts=True))).convert("RGBA")
    assert raster.size == (1024, 1024)
    assert raster.getchannel("A").getextrema() == (255, 255), "Icon must be fully opaque."
    # Apple app icons must not carry an alpha channel, even when fully opaque.
    raster.convert("RGB").save(output, format="PNG", optimize=True)
    with Image.open(output) as exported:
        assert exported.size == (1024, 1024) and exported.mode == "RGB"
        assert "transparency" not in exported.info
        for corner in [(0, 0), (1023, 0), (0, 1023), (1023, 1023)]:
            assert exported.getpixel(corner) == (248, 246, 240)
    print(f"Rendered {output.relative_to(ROOT)}: 1024×1024 RGB PNG, no alpha; catalog reference valid.")


if __name__ == "__main__":
    render()
