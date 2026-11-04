VELORA — product photography
One photo per perfume, using EXACTLY these filenames, in this folder (public/assets/perfumes/).

Format: SQUARE, white background, JPG (the site displays every bottle in a 1:1 frame with object-fit: contain).
You do not need to crop or centre new photos by hand:
  1. drop the raw photo into assets-originals/perfumes/ using the filename below,
  2. run:  python3 scripts/normalize-perfumes.py
It trims the whitespace, scales every bottle to the same visual size and centres it on a 900x900 white square.
Leave the top corners calm: the product card overlays the brand name and tagline there.
Until a file exists, a labelled placeholder is shown.

FOR HER
dg-the-one.jpg                              -> Dolce & Gabbana — The One
lancome-la-nuit-tresor.jpg                  -> Lancôme — La Nuit Trésor
valentino-born-in-roma-donna-intense.jpg    -> Valentino — Born in Roma Donna Intense
kayali-vanilla-28.jpg                       -> Kayali — Vanilla | 28
versace-crystal-noir.jpg                    -> Versace — Crystal Noir
givenchy-linterdit-eau-de-parfum-rouge.jpg  -> Givenchy — L'Interdit Eau de Parfum Rouge
jpg-gaultier-divine.jpg                     -> Jean Paul Gaultier — Gaultier Divine
ysl-libre.jpg                               -> Yves Saint Laurent — Libre
dior-miss-dior-blooming-bouquet.jpg         -> Dior — Miss Dior Blooming Bouquet
jpg-scandal.jpg                             -> Jean Paul Gaultier — Scandal

FOR HIM
viktor-rolf-spicebomb-extreme.jpg           -> Viktor&Rolf — Spicebomb Extreme
givenchy-gentleman-reserve-privee.jpg       -> Givenchy — Gentleman Réserve Privée
jpg-le-beau-le-parfum.jpg                   -> Jean Paul Gaultier — Le Beau Le Parfum
versace-eros.jpg                            -> Versace — Eros
chanel-bleu-de-chanel.jpg                   -> Chanel — Bleu de Chanel
dior-sauvage.jpg                            -> Dior — Sauvage
armani-stronger-with-you-intensely.jpg      -> Emporio Armani — Stronger With You Intensely
jpg-scandal-pour-homme-le-parfum.jpg        -> Jean Paul Gaultier — Scandal Pour Homme Le Parfum
carolina-herrera-bad-boy-cobalt.jpg         -> Carolina Herrera — Bad Boy Cobalt
paco-rabanne-1-million.jpg                  -> Paco Rabanne — 1 Million

UNISEX
khadlaj-karus-gold-absolu.jpg               -> Khadlaj — Karus Gold Absolu
xerjoff-torino21.jpg                        -> Xerjoff — Torino21
ysl-babycat.jpg                             -> Yves Saint Laurent — Babycat
kilian-black-phantom-memento-mori.jpg       -> Kilian Paris — Black Phantom Memento Mori
xerjoff-naxos.jpg                           -> Xerjoff — Naxos
armani-acqua-di-gio-profondo.jpg            -> Giorgio Armani — Acqua Di Giò Profondo
