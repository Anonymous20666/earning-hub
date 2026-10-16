"""Optional reproducible font subsetting. Input: Debian fonts-noto-core NotoSansMath-Regular.ttf.
Needs fonttools + brotli. Runtime/build do not require either: the small WOFF2 is checked in.
Preserves original copyright/OFL fields; renames the modified font family.
"""
import sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
source=Path(sys.argv[1] if len(sys.argv)>1 else '/usr/share/fonts/truetype/noto/NotoSansMath-Regular.ttf')
f=TTFont(source,recalcTimestamp=False)
options=subset.Options();options.flavor='woff2';options.name_IDs=['*'];options.name_legacy=True
subsetter=subset.Subsetter(options=options);subsetter.populate(unicodes=list(range(0x1d400,0x1d800))+list(range(0x2100,0x2150)));subsetter.subset(f)
for n in f['name'].names:
 if n.nameID in (1,3,4,6,16):
  value='PappyMathSymbols-Regular' if n.nameID==6 else 'Pappy Math Symbols'
  n.string=value.encode(n.getEncoding(),errors='replace')
f.flavor='woff2';f.save('public/fonts/pappy-math-v1.woff2')
print('Saved',Path('public/fonts/pappy-math-v1.woff2').stat().st_size,'byte OFL-licensed Unicode math subset')
