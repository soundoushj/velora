# Perfume image fix — what changed

Cause: product photos were rendered with `object-fit: cover` inside 6:5 (cards) and 4:5 (details, bag) frames,
so caps and bases were cropped; photos also had very different whitespace, so bottle sizes were inconsistent.

CSS (src/styles): `.pimg` now `object-fit: contain; object-position: center`; card / details / bag / search frames are 1:1;
the conflicting `cover` rule on `.pcard-img .pimg` was replaced. `--bottle-inset` sets the breathing room around the bottle
(cards keep clear of the brand/tagline overlay; details page uses a small inset).

Images (public/assets/perfumes): same 25 filenames, re-framed to 900x900 white squares with the bottle centred at a consistent
scale. Untouched originals are in assets-originals/perfumes/. Re-run with `python3 scripts/normalize-perfumes.py`.

Not touched: hero video, colours, fonts, animations, other components.
