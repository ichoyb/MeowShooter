"""Regenerate the checked-in runtime WOFF2 from the pinned display font."""

import hashlib
import json
from pathlib import Path
import subprocess
import sys

from fontTools import subset
from fontTools.ttLib import TTFont


APP = Path(__file__).resolve().parent.parent
SOURCE_SHA = "dfc757d9c5ae597cac15b12a51a1cee07af500cc8cf7439b243e1bb94b2b1f83"
OUTPUT = APP / "assets/ui/ResourceHanRoundedCN-Heavy.woff2"
MANIFEST = APP / "src/ui/design-language-font.json"


def main():
    source = Path(sys.argv[1])
    if hashlib.sha256(source.read_bytes()).hexdigest() != SOURCE_SHA:
        raise SystemExit("Resource Han Rounded CN Heavy v0.990 source SHA-256 mismatch")
    glyphs = subprocess.check_output(
        ["node", str(APP / "tools/visual-language.mjs"), "--glyphs"], cwd=APP, encoding="utf-8"
    )
    with TTFont(source, recalcTimestamp=False) as font:
        cmap = font.getBestCmap()
        missing = [char for char in glyphs if ord(char) not in cmap]
        if missing:
            raise SystemExit("官方字体缺字：" + "".join(missing))
        options = subset.Options()
        options.name_IDs = ["*"]
        options.layout_features = ["*"]
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(text=glyphs)
        subsetter.subset(font)
        font.flavor = "woff2"
        font.save(OUTPUT)
    with TTFont(OUTPUT) as font:
        if any(ord(char) not in font.getBestCmap() for char in glyphs):
            raise SystemExit("子集字体缺少展示字符")
    record = {"sourceSha256": SOURCE_SHA, "glyphs": glyphs, "sha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest()}
    MANIFEST.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(glyphs)} glyphs, {OUTPUT.stat().st_size} B")


if __name__ == "__main__":
    main()
