# Usage : python scripts/calques-logo.py public/marque/logo-x-detailing-officiel.png public/marque src/components/accueil/contour-x.json
# (dépendances : numpy, pillow, opencv-python-headless)
#
# Calques d'animation dérivés du logo officiel, SANS retouche :
# alpha = luminance max, couleur dé-prémultipliée → composé sur noir, on
# retrouve exactement les pixels d'origine.
import sys, json
import numpy as np, cv2
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
_src = Image.open(src)
# Le logo d'origine est fourni sur fond noir, sans transparence : on la déduit
# alors de la luminance. Mais un fichier qui porte déjà son canal alpha est
# découpé proprement — la recalculer l'écrase et ne laisse qu'un trait violet.
_a_alpha = _src.mode in ("RGBA", "LA") and np.asarray(_src.convert("RGBA"))[..., 3].min() == 0
im = np.asarray(_src.convert("RGB")).astype(np.float64)
H, W, _ = im.shape
# Lignes du mot DETAILING et du trait qui le souligne — tout ce qui est sous le X.
# Détectées au lieu d'être codées en dur : la bande dépend du cadrage du fichier
# source, et une valeur figée découpe le logo au mauvais endroit dès qu'il change.
def _bande(mx_, hauteur_, largeur_):
    encre = (mx_ > 20).sum(axis=1)
    pleines = np.where(encre > largeur_ * 0.01)[0]
    coupures = [i for i in range(1, len(pleines)) if pleines[i] - pleines[i - 1] > 5]
    if not coupures:
        raise SystemExit("Aucune séparation trouvée entre le X et le texte.")
    return (int(pleines[coupures[0]]), hauteur_)

mx = im.max(axis=2)
BANDE = _bande(mx, H, W)
print(f"bande détectée : lignes {BANDE[0]}–{BANDE[1]}")
# Fond quasi noir (≤ 14/255, invisible sur le noir de la page) → transparent :
# sans cela le léger bruit du fond rend les fichiers lourds.
if _a_alpha:
    rgba = np.asarray(_src.convert("RGBA")).astype(np.uint8)
    mx = rgba[..., :3].max(axis=2).astype(np.float64) * (rgba[..., 3] > 0)
else:
    mx_util = np.where(mx <= 14, 0, mx)
    alpha = mx_util / 255.0
    rgb = np.where(alpha[..., None] > 0, im / np.maximum(alpha[..., None], 1e-6), 0)
    rgba = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)

x_seul = rgba.copy()
x_seul[BANDE[0]:BANDE[1], :, 3] = 0
texte = rgba[BANDE[0]:BANDE[1], :, :].copy()

def ecrire(arr, nom, largeur):
    img = Image.fromarray(arr, "RGBA")
    if img.width != largeur:
        img = img.resize((largeur, round(img.height * largeur / img.width)), Image.LANCZOS)
    img.save(f"{out}/{nom}-{largeur}.webp", "WEBP", quality=82, method=6)

for l in (640, 1254):
    ecrire(x_seul, "x", l)
    ecrire(texte, "detailing", l)

# Contour vectoriel du X (pour la ligne lumineuse) : pièces du X seulement.
masque = ((mx > 120).astype(np.uint8)) * 255
masque[BANDE[0]:BANDE[1], :] = 0
masque = cv2.morphologyEx(masque, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
contours, _ = cv2.findContours(masque, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
chemins = []
for c in sorted(contours, key=cv2.contourArea, reverse=True):
    if cv2.contourArea(c) < 800:
        continue
    p = cv2.approxPolyDP(c, 2.0, True).reshape(-1, 2)
    chemins.append("M" + " L".join(f"{x} {y}" for x, y in p) + " Z")
json.dump({"largeur": W, "hauteur": H, "bande": BANDE, "chemins": chemins}, open(sys.argv[3] if len(sys.argv) > 3else f"{out}/contour-x.json", "w"))
print(len(chemins), "pièces", [len(c) for c in chemins])

