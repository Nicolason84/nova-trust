#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOPO = json.loads((ROOT / "docs/data/france-topology.json").read_text())
CULTURE = json.loads((ROOT / "docs/data/la-bete-territory-culture-v1.json").read_text())
QUESTS = json.loads((ROOT / "docs/data/phi-territory-quests-v1.json").read_text())

OISE_TOURISM = "https://oise.fr/actions/tourisme"
OISE_PIERREFONDS = "https://www.oisetourisme.com/visiter/les-incontournables/le-chateau-de-pierrefonds/"
OISE_CHANTILLY = "https://www.oisetourisme.com/visiter/les-incontournables/le-chateau-de-chantilly/"
OISE_COMPIEGNE = "https://www.oisetourisme.com/visiter/les-incontournables/le-chateau-de-compiegne/"
OISE_FOREST_ROUTE = "https://www.oisetourisme.com/itineraire/la-foret-imperiale-de-compiegne/"
OISE_PICARD = "https://archives.oise.fr/fileadmin/user_upload/archives/decouvrir/publications-et-ressources/expositions_itinerantes/mille-ans-d-ecriture-dans-l-oise/dossier_pedagogique_ecriture.pdf"

COMMONS_PIERREFONDS = "https://commons.wikimedia.org/wiki/File:Ch%C3%A2teau_de_Pierrefonds_exterior_Oise.jpg"
COMMONS_CHANTILLY = "https://commons.wikimedia.org/wiki/File:Ch%C3%A2teau_de_Chantilly,_jardin_%C3%A0_la_fran%C3%A7aise,_miroir_d%27eau_et_grand_bassin.jpg"
COMMONS_BEAUVAIS = "https://commons.wikimedia.org/wiki/File:Beauvais_Cathedral_SE_exterior.jpg"

CIVIC = {
    "state": "STABLE_CIVIC_NAVIGATION_ONLY",
    "background": "#101820",
    "surface": "#182832",
    "text": "#EEF3F1",
    "muted": "#A8B7BA",
    "line": "#334650",
    "accent": "#B58A62",
    "meaning": "Palette d'interface stable. Elle n'est pas présentée comme une couleur identitaire du territoire.",
}

def pending_department(profile: dict) -> dict:
    return {
        "code": profile["code"],
        "name": profile["name"],
        "state": "LIVING_IDENTITY_BASELINE_READY_LOCAL_EVIDENCE_PENDING",
        "palette": {
            "civic": CIVIC,
            "identity": {
                "state": "PENDING_LOCAL_EVIDENCE",
                "colors": [],
                "rule": "Aucune couleur identitaire locale n'est attribuée sans motifs territoriaux sourcés.",
            },
            "seasonal": {
                "state": "DISABLED_UNTIL_IDENTITY_VERIFIED",
                "variants": [],
                "rule": "Une ambiance saisonnière est une couche éditoriale, jamais une observation météo.",
            },
        },
        "media": {
            "state": "PENDING_LICENSED_LOCAL_MEDIA",
            "hero_media_id": None,
            "items": [],
        },
        "points_of_interest": [],
        "commons_useful": [],
        "opportunities": [],
        "connections": [],
        "signals_of_need": [
            {
                "id": "territory_identity_media",
                "label": "Sourcer couleurs, images, lieux et initiatives locales",
                "state": "OPEN_DOCUMENTATION_GAP",
                "source": "phi-territory-quests-v1.json",
            }
        ],
        "reading_modes": {
            "feel": ["couleurs", "grande image", "pourquoi ce territoire compte"],
            "explore": ["points d'intérêt", "initiatives", "opportunités", "relations"],
            "deepen": ["sources", "preuves", "quêtes Φ", "données détaillées"],
        },
    }

departments = {
    code: pending_department(profile)
    for code, profile in CULTURE["departments"].items()
}

oise = departments["60"]
oise["state"] = "LIVING_IDENTITY_VERIFIED_PILOT"
oise["palette"]["identity"] = {
    "state": "VERIFIED_EDITORIAL_SYNTHESIS_FROM_SOURCED_MOTIFS",
    "rule": "Palette éditoriale construite à partir de motifs documentés (forêts, eau, patrimoine minéral) ; ce n'est ni une couleur officielle ni un classement esthétique.",
    "source": OISE_TOURISM,
    "colors": [
        {"id": "forest", "label": "Forêt", "hex": "#41624B"},
        {"id": "stone", "label": "Pierre claire", "hex": "#C7B68E"},
        {"id": "water", "label": "Eau", "hex": "#5D7E8B"},
        {"id": "mist", "label": "Brume", "hex": "#D8DEDB"},
        {"id": "earth", "label": "Terre", "hex": "#8B7359"},
    ],
}
oise["palette"]["seasonal"] = {
    "state": "EDITORIAL_VARIANTS_FROM_VERIFIED_IDENTITY_PALETTE",
    "rule": "Variantes d'ambiance. Elles ne décrivent pas la météo réelle ni l'état présent du paysage.",
    "variants": [
        {"id": "spring", "label": "Printemps", "accent": "#78976F", "surface": "#D9E1D4"},
        {"id": "autumn", "label": "Automne", "accent": "#9B6746", "surface": "#3A3029"},
        {"id": "night", "label": "Nuit", "accent": "#7C9CB0", "surface": "#111A24"},
    ],
}
oise["media"] = {
    "state": "LICENSED_AND_ATTRIBUTED_LOCAL_MEDIA",
    "hero_media_id": "oise-pierrefonds-presence",
    "items": [
        {
            "id": "oise-pierrefonds-presence",
            "kind": "presence",
            "label": "Château de Pierrefonds",
            "caption": "Présence patrimoniale à l'orée de la forêt de Compiègne.",
            "commune_code": "60491",
            "asset": "assets/territory/oise/pierrefonds-cc0.jpg",
            "source_page": COMMONS_PIERREFONDS,
            "author": "Jebulon",
            "license": "CC0 1.0",
            "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
            "place_source": OISE_PIERREFONDS,
        },
        {
            "id": "oise-chantilly-culture",
            "kind": "culture",
            "label": "Domaine de Chantilly · jardins",
            "caption": "Eau, jardins et patrimoine du domaine de Chantilly.",
            "commune_code": "60141",
            "asset": "assets/territory/oise/chantilly-cc-by-sa-2-fr.jpg",
            "source_page": COMMONS_CHANTILLY,
            "author": "P.poschadel",
            "license": "CC BY-SA 2.0 FR",
            "license_url": "https://creativecommons.org/licenses/by-sa/2.0/fr/",
            "place_source": OISE_CHANTILLY,
        },
        {
            "id": "oise-beauvais-proof",
            "kind": "culture",
            "label": "Cathédrale Saint-Pierre de Beauvais",
            "caption": "Architecture patrimoniale de Beauvais.",
            "commune_code": "60057",
            "asset": "assets/territory/oise/beauvais-cathedral-cc-by-sa-2.jpg",
            "source_page": COMMONS_BEAUVAIS,
            "author": "James Mitchell",
            "license": "CC BY-SA 2.0",
            "license_url": "https://creativecommons.org/licenses/by-sa/2.0/",
            "place_source": OISE_TOURISM,
        },
    ],
}
oise["points_of_interest"] = [
    {"id": "pierrefonds", "label": "Château de Pierrefonds", "family": "patrimoine", "commune_code": "60491", "state": "VERIFIED", "source": OISE_PIERREFONDS},
    {"id": "chantilly", "label": "Château de Chantilly", "family": "patrimoine", "commune_code": "60141", "state": "VERIFIED", "source": OISE_CHANTILLY},
    {"id": "compiegne", "label": "Château de Compiègne", "family": "patrimoine", "commune_code": "60159", "state": "VERIFIED", "source": OISE_COMPIEGNE},
    {"id": "forest-compiegne", "label": "Forêt de Compiègne", "family": "nature", "commune_code": "60159", "state": "VERIFIED", "source": OISE_FOREST_ROUTE},
]
oise["commons_useful"] = [
    {
        "id": "forest-cycle-route",
        "label": "Itinéraire cyclable de la Forêt impériale de Compiègne",
        "family": "mobilite_douce",
        "state": "VERIFIED_PUBLIC_ROUTE",
        "source": OISE_FOREST_ROUTE,
    }
]
oise["opportunities"] = [
    {
        "id": "picard-local-variants",
        "label": "Documenter les variantes et expressions picardes commune par commune",
        "family": "connaissance_locale",
        "state": "OPEN_VERIFIED_CONTRIBUTION",
        "economic_claim": False,
        "source": OISE_PICARD,
    },
    {
        "id": "forest-castles-links",
        "label": "Mieux relier dans l'Atlas les parcours forêt · châteaux · mémoire",
        "family": "mediation_territoriale",
        "state": "PRODUCT_OPPORTUNITY_TO_VALIDATE",
        "economic_claim": False,
        "source": OISE_FOREST_ROUTE,
    },
    {
        "id": "local-initiatives-gap",
        "label": "Identifier et sourcer les initiatives locales utiles encore invisibles",
        "family": "commun",
        "state": "OPEN_DOCUMENTATION_GAP",
        "economic_claim": False,
        "source": "phi-territory-quests-v1.json",
    },
]
oise["connections"] = [
    {
        "id": "compiegne-pierrefonds-forest-corridor",
        "label": "Compiègne ↔ Pierrefonds · forêt et itinéraire documenté",
        "state": "VERIFIED_ROUTE_RELATION",
        "commune_codes": ["60159", "60491"],
        "source": OISE_FOREST_ROUTE,
    }
]
oise_quests = QUESTS["territories"]["60"]
oise["signals_of_need"] = [
    {
        "id": q["id"],
        "label": q["label"],
        "state": q["state"],
        "remaining_items": q["remaining_items"],
        "source": "phi-territory-quests-v1.json",
    }
    for q in oise_quests["quests"]
    if q["state"] != "COMPLETE"
]

commune_overlays = {
    "60491": {
        "name": "Pierrefonds",
        "state": "VERIFIED_LOCAL_OVERLAY",
        "media_ids": ["oise-pierrefonds-presence"],
        "things_to_do": [
            {"label": "Découvrir le château", "state": "VERIFIED", "source": OISE_PIERREFONDS},
            {"label": "Relier patrimoine et forêt", "state": "VERIFIED_ROUTE_CONTEXT", "source": OISE_FOREST_ROUTE},
        ],
        "shared_links": ["60159"],
    },
    "60141": {
        "name": "Chantilly",
        "state": "VERIFIED_LOCAL_OVERLAY",
        "media_ids": ["oise-chantilly-culture"],
        "things_to_do": [
            {"label": "Explorer le domaine et les jardins", "state": "VERIFIED", "source": OISE_CHANTILLY},
        ],
        "shared_links": [],
    },
    "60057": {
        "name": "Beauvais",
        "state": "VERIFIED_LOCAL_OVERLAY",
        "media_ids": ["oise-beauvais-proof"],
        "things_to_do": [
            {"label": "Documenter le patrimoine local au-delà de la seule donnée administrative", "state": "OPEN_VERIFIED_CONTRIBUTION", "source": OISE_TOURISM},
        ],
        "shared_links": [],
    },
    "60159": {
        "name": "Compiègne",
        "state": "VERIFIED_LOCAL_OVERLAY",
        "media_ids": [],
        "things_to_do": [
            {"label": "Explorer le château", "state": "VERIFIED", "source": OISE_COMPIEGNE},
            {"label": "Parcourir la forêt impériale à vélo", "state": "VERIFIED_PUBLIC_ROUTE", "source": OISE_FOREST_ROUTE},
        ],
        "shared_links": ["60491"],
    },
}

doc = {
    "schema": "LA_BETE_TERRITORY_LIVING_IDENTITY_V1",
    "state": "NATIONAL_SAFE_BASELINE_OISE_VERIFIED_PILOT",
    "generated_from_topology_snapshot": TOPO["detail"]["snapshot_id"],
    "generated_from_culture_schema": CULTURE["schema"],
    "generated_from_quests_schema": QUESTS["schema"],
    "departments_count": len(departments),
    "principle": "Rendre chaque territoire reconnaissable, utile et contributif sans transformer une ambiance éditoriale en fait non sourcé.",
    "reading_modes": [
        {"id": "feel", "label": "Ressentir", "purpose": "Couleurs, image, phrases simples et raisons d'explorer."},
        {"id": "explore", "label": "Explorer", "purpose": "Lieux, initiatives, opportunités et relations."},
        {"id": "deepen", "label": "Approfondir", "purpose": "Sources, preuves, données détaillées et quêtes Φ."},
    ],
    "media_grammar": [
        {"id": "presence", "label": "Images de présence", "purpose": "Faire sentir le lieu sans prétendre résumer tout le territoire."},
        {"id": "culture", "label": "Images de preuve / culture", "purpose": "Documenter patrimoine, mémoire, savoir-faire ou langue avec provenance."},
        {"id": "useful", "label": "Images utiles", "purpose": "Aider à agir, se déplacer ou trouver un équipement lorsqu'une source le permet."},
        {"id": "social", "label": "Images sociales", "purpose": "Montrer une initiative ou un commun avec accord et contexte vérifiables."},
    ],
    "guards": {
        "no_random_identity_color": True,
        "no_unlicensed_image": True,
        "image_attribution_required": True,
        "season_is_editorial_not_weather_observation": True,
        "opportunity_is_not_market_demand": True,
        "empty_is_better_than_fabricated": True,
    },
    "departments": departments,
    "commune_overlays": commune_overlays,
}

out = ROOT / "docs/data/la-bete-territory-living-identity-v1.json"
out.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
print("LIVING_IDENTITY_DEPARTMENTS", len(departments))
print("VERIFIED_IDENTITY_DEPARTMENTS", sum(d["palette"]["identity"]["state"].startswith("VERIFIED") for d in departments.values()))
print("OISE_MEDIA", len(oise["media"]["items"]))
print("COMMUNE_OVERLAYS", len(commune_overlays))
