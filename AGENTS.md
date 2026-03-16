# AGENTS.md - E - AAR READER HUB

## Role
Ce dossier (`E - AAR READER HUB`) est le hub de lecture principal des AAR.

## Couplage obligatoire
- Le schema AAR doit rester aligne avec `C - AAR PWA/AAR.html`.
- Toute evolution de parsing/champs dans `app.js` doit etre repercutee dans:
  - `AAR READER HUB QWI/app.js`
  - `AAR READER HUB QWI/qwi-mode.js` (si le flux d'edition est impacte)
- Toute evolution de rendu detail/PDF ici doit etre refletee dans la variante QWI, sauf decision explicite contraire.

## Regle de livraison
Quand tu modifies ce hub, verifie toujours l'impact sur:
1. `C - AAR PWA` (formulaire et schema)
2. `AAR READER HUB QWI` (ajout/edition/suppression + rendu)
