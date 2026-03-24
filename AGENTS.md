# AGENTS.md - D - AAR READER HUB

## Role
Ce dossier (`D - AAR READER HUB`) est le hub principal NON QWI (lecture/filtrage/analyse/impression).

## Points de schema a maintenir (maj 2026-03-24)
- Afficher `BAAP` pour le type AAR technique `FLASH`.
- Respecter l'anonymisation emise par `C - AAR PWA`:
  - si `meta.identityAnonymized=true` (ou `meta.identityVisibility=QWI_ONLY`), ne pas afficher `grade/nom/prenom/unite` dans le hub NON QWI.
  - garde-fou compatibilite backend: si les flags d'anonymisation sont absents mais que les champs neutres (`ANONYME` / `ANONYMISE`) sont presents, traiter quand meme le dossier comme anonymise.
  - garde-fou de marquage: si `meta.hashtags` contient `#ANONYME`, traiter le dossier comme anonymise.
  - contrainte UX: `#ANONYME` est un marqueur interne et ne doit pas apparaitre dans les hashtags visibles (cartes, filtres, detail); filtrage applique des l'extraction des hashtags.
  - garde-fou legacy: si le nom de fichier source contient `anonymise`, forcer aussi le rendu anonymise cote NON QWI.
  - libelle redacteur en mode anonymise: afficher une seule valeur `ANONYME` (pas de duplication type `ANONYMISE ANONYME ANONYME`).
  - tag visuel en carte: afficher `ANONYME` (style `LOG`) quand le dossier est anonymise.
  - ne pas reinjecter ces champs dans les blobs de recherche/filtrage NON QWI.
- Le rendu des faits doit inclure les blocs BAAP enrichis si presents:
  - `facts.baapSelected`,
  - `facts.baapAirfield`,
  - `facts.baapPilot`,
  - `facts.baapLoadmaster`,
  - `facts.baapMissionSupport`,
  - `facts.baapIntel`,
  - `facts.baapC2`.
- La lecture des hashtags (`meta.hashtags`) doit rester compatible avec le referentiel dynamique des boutons `1. FAITS` (`catalog.factsHashtags`) et leur mapping d'infobulle (`catalog.factsHashtagTooltipMap`).
- Les cles d'infobulles associees aux boutons `#` peuvent etre `BAAP_ROLE_*` ou dynamiques `FACTS_HASHTAG_*` (a ne pas filtrer/casser lors des lectures catalogue).
- Le filtre `Hashtag` du HUB NON QWI est en multi-selection avec recherche texte:
  - logique d'application: ET (un AAR doit contenir tous les hashtags selectionnes),
  - persistance locale: tableau `hashtags[]` (avec compatibilite legacy de lecture `hashtag`),
  - UX de selection: panneau searchable avec compteurs d'occurrences (`n AAR`) + actions rapides (`Tout selectionner` / `Effacer` / `Inverser`) + suppression directe des hashtags deja selectionnes,
  - navigation clavier: dans la recherche hashtag, `fleche bas` / `fleche haut` pour naviguer, `Entree` pour selectionner/valider le hashtag actif,
  - contrainte d'affichage: le panneau des filtres hashtags doit rester au-dessus de la grille AAR (pas de recouvrement/coupure par les cartes),
  - `#ANONYME` reste masque dans les options visibles.
- Le filtre `Mission (LOG/TAC)` est retire du HUB NON QWI.
- Le filtre `Code OACI` le remplace:
  - selection unique (pas de multi-selection),
  - recherche texte + navigation clavier (`fleche bas` / `fleche haut` / `Entree`),
  - persistance locale via la cle filtre `oaci`.
- Rendu visuel des tags en cartes:
  - hashtags `#...` en style gris neutre (`tag-hashtag`),
  - categories DORESE en rose (`tag-dorese`).
- Rendu tags DORESE (`DOCTRINE`, `ORGANISATION`, `RH`, `EQUIPEMENTS`, `SOUTIEN`, `ENTRAINEMENT`): utiliser une couleur dediee distincte des tags classification (`NP/DR/SSF`), anonymisation (`ANONYME`) et flotte (`AIRCRAFT`).

## Couplage obligatoire
- Le schema AAR doit rester aligne avec `C - AAR PWA/AAR.html`.
- Toute evolution de parsing/champs/rendu dans `app.js` doit etre repercutee dans le hub QWI:
  - `../E - AAR READER HUB QWI/app.js`,
  - `../E - AAR READER HUB QWI/qwi-mode.js` (si le flux d'edition est impacte).
- Toute evolution de rendu detail/PDF ici doit etre refletee dans la variante QWI, sauf decision explicite contraire.

## Regle de livraison
Quand tu modifies ce hub:
1. Verifier l'impact sur `C - AAR PWA`.
2. Verifier l'impact sur `E - AAR READER HUB QWI`.
3. Mettre a jour les `AGENTS.md` impactes (au minimum racine + `D` + `E` + sous-dossiers techniques concernes).

## Regles d'encodage
- Tous les fichiers texte (`.js`, `.html`, `.css`, `.md`, `.json`) en `UTF-8`.
- En scripts PowerShell, forcer `-Encoding UTF8`.
- Controle anti-mojibake avant commit/push.

## Contexte d'exploitation
- Pipeline nominal: e-mail AAR -> Apps Script ingest -> Drive -> hubs.
- Le hub non QWI lit en priorite via Apps Script (`action=listAars`).
- Le push GitHub reste pour le code front, pas pour les donnees metier.
- `AAR_ACCESS_KEY` doit matcher avec `C - AAR PWA/mission-config.js` et `../E - AAR READER HUB QWI/config.js`.
