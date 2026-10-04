#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOPO = json.loads((ROOT/'docs/data/france-topology.json').read_text())
ORG = json.loads((ROOT/'docs/data/france-organism.json').read_text())
detail = TOPO['detail']
regions = {str(r['code']): r['name'] for r in ORG['topology']['regions']}

LANG_SOURCE = 'https://www.culture.gouv.fr/catalogue-des-demarches-et-subventions/subvention/valorisation-des-langues-de-france'
HDF_SOURCE = 'https://www.culture.gouv.fr/thematiques/langue-francaise-et-langues-de-france/agir-pour-les-langues/s-approprier-la-langue-politiques-nationales-et-territoires/renforcer-la-cooperation-entre-l-etat-et-les-collectivites-territoriales'
HDF_DEPARTMENTS = {'02','59','60','62','80'}
OISE_PICARD_SOURCE = 'https://archives.oise.fr/fileadmin/user_upload/archives/decouvrir/publications-et-ressources/expositions_itinerantes/mille-ans-d-ecriture-dans-l-oise/dossier_pedagogique_ecriture.pdf'
BNF_PICARD_SOURCE = 'https://catalogue.bnf.fr/ark:/12148/cb119331323'

profiles = {}
for d in detail['departments']:
    code = d['code']
    p = {
        'code': code,
        'name': d['name'],
        'region_code': d['region_code'],
        'region_name': regions.get(d['region_code']),
        'state': 'BASELINE_READY_LOCAL_ENRICHMENT_OPEN',
        'narrative_contract': {
            'economy_only': False,
            'required_dimensions': ['territory','people_and_places','heritage','languages','know_how','memory','initiatives','nature_and_risks'],
            'no_fabrication': True,
            'community_contributions_require_source_or_explicit_testimony_label': True,
        },
        'baseline': {
            'commune_count': d['commune_count'],
            'epci_count': len(d.get('epci_codes', [])),
            'population_sum_api': d['population_sum'],
            'population_known_count': d['population_known_count'],
            'population_vintage': detail.get('population_vintage'),
        },
        'story_slots': [
            {'id':'places','label':'Lieux qui comptent','state':'OPEN_FOR_VERIFIED_LOCAL_CONTRIBUTIONS'},
            {'id':'heritage','label':'Patrimoine & mémoire','state':'OPEN_FOR_VERIFIED_LOCAL_CONTRIBUTIONS'},
            {'id':'languages','label':'Langues & expressions','state':'OPEN_FOR_VERIFIED_LOCAL_CONTRIBUTIONS'},
            {'id':'know_how','label':'Savoir-faire & métiers','state':'OPEN_FOR_VERIFIED_LOCAL_CONTRIBUTIONS'},
            {'id':'people','label':'Figures & récits locaux','state':'OPEN_FOR_VERIFIED_LOCAL_CONTRIBUTIONS'},
            {'id':'events','label':'Événements & traditions','state':'OPEN_FOR_VERIFIED_LOCAL_CONTRIBUTIONS'},
            {'id':'nature','label':'Paysages, nature & risques','state':'OPEN_FOR_VERIFIED_LOCAL_CONTRIBUTIONS'},
            {'id':'initiatives','label':'Initiatives utiles aujourd’hui','state':'OPEN_FOR_VERIFIED_LOCAL_CONTRIBUTIONS'},
        ],
        'local_language': {
            'state': 'TO_DOCUMENT_LOCALLY',
            'options': [],
            'source_scope': 'NONE',
            'warning': 'Ne jamais attribuer automatiquement un parler à tout un département.',
        },
        'contribution_topics': ['source_officielle','correction','traduction','langue_locale','patrimoine','savoir_faire','memoire_locale','lieu','evenement','accessibilite'],
    }
    if code in HDF_DEPARTMENTS:
        p['local_language'] = {
            'state': 'REGIONAL_CONTEXT_VERIFIED_LOCAL_USE_TO_DOCUMENT',
            'options': [],
            'regional_context': [
                {'id':'picard','label':'Picard','state':'HAUTS_DE_FRANCE_CONTEXT','source':HDF_SOURCE},
                {'id':'western_flemish','label':'Flamand occidental','state':'HAUTS_DE_FRANCE_CONTEXT','source':HDF_SOURCE},
            ],
            'source_scope': 'HAUTS_DE_FRANCE_PACT',
            'warning': 'Le pacte régional valorise le picard et le flamand occidental. Cette source seule ne permet pas d’attribuer l’une de ces langues à toutes les communes de chaque département.',
        }
    if code == '60':
        p['local_language'] = {
            'state': 'DEPARTMENT_PICARD_CONTEXT_VERIFIED_LOCAL_VARIANTS_TO_DOCUMENT',
            'options': [
                {'id':'picard','label':'Picard','state':'DEPARTMENT_LINGUISTIC_CONTEXT','source':OISE_PICARD_SOURCE},
            ],
            'regional_context': [
                {'id':'picard','label':'Picard','state':'HAUTS_DE_FRANCE_CONTEXT','source':HDF_SOURCE},
                {'id':'western_flemish','label':'Flamand occidental','state':'HAUTS_DE_FRANCE_CONTEXT','source':HDF_SOURCE},
            ],
            'source_scope': 'OISE_ARCHIVES_AND_BNF',
            'warning': 'Les Archives départementales de l’Oise documentent le domaine linguistique picard dans l’Oise. Les variantes, usages actuels et expressions restent à sourcer localement commune par commune.',
            'additional_sources': [OISE_PICARD_SOURCE, BNF_PICARD_SOURCE],
        }
    profiles[code] = p

culture = {
    'schema': 'LA_BETE_TERRITORY_CULTURE_V1',
    'state': 'ALL_101_DEPARTMENTS_BASELINE_READY_LOCAL_ENRICHMENT_OPEN',
    'generated_from_topology_snapshot': detail['snapshot_id'],
    'departments_count': len(profiles),
    'principle': 'Chaque département mérite un portrait vivant qui dépasse les seules données économiques.',
    'language_modes': {
        'interface': [
            {'id':'fr','label':'Français','state':'AVAILABLE'},
            {'id':'en','label':'English','state':'AVAILABLE_ESSENTIAL_LAYER'},
            {'id':'es','label':'Español','state':'AVAILABLE_ESSENTIAL_LAYER'},
            {'id':'local','label':'Parler local','state':'CONTEXTUAL_ONLY_WHEN_SOURCED'},
        ],
        'policy': 'Une langue locale n’est jamais inventée ni appliquée automatiquement à tout un territoire. Les variantes locales restent sourcées et révisables.',
    },
    'sources': [
        {'id':'DGLFLF_LANGUES_DE_FRANCE','publisher':'Ministère de la Culture','url':LANG_SOURCE,'supports':'official list and public value of regional languages'},
        {'id':'HDF_PACTE_LINGUISTIQUE','publisher':'Ministère de la Culture','url':HDF_SOURCE,'supports':'Hauts-de-France pact; regional context for Picard and Western Flemish; Oise among departments that joined in 2022'},
        {'id':'OISE_ARCHIVES_PICARD','publisher':'Archives départementales de l’Oise','url':OISE_PICARD_SOURCE,'supports':'department-specific evidence that the Picard linguistic domain includes parts of the Oise'},
        {'id':'BNF_PICARD','publisher':'Bibliothèque nationale de France','url':BNF_PICARD_SOURCE,'supports':'authority record for Picard and bibliographic references including literature and speech of the Oise'},
    ],
    'departments': profiles,
}
(ROOT/'docs/data/la-bete-territory-culture-v1.json').write_text(json.dumps(culture, ensure_ascii=False, indent=2)+'\n')

phi = {
    'schema': 'LA_BETE_PHI_COINS_V1',
    'symbol': 'Φ',
    'name': 'Phi Coins',
    'state': 'CIVIC_RECOGNITION_DESIGN_NO_LEDGER_NO_WALLET',
    'purpose': 'Reconnaître les contributions vérifiables qui améliorent le bien commun territorial.',
    'financial_status': {
        'money': False,
        'cryptoasset': False,
        'transferable': False,
        'purchasable': False,
        'redeemable_for_cash': False,
        'investment_return': False,
        'market_price': None,
        'wallet': 'NOT_IMPLEMENTED',
        'ledger': 'NOT_IMPLEMENTED',
    },
    'award_rule': 'Aucun Φ n’est acquis sur simple soumission. Une contribution doit être acceptée après vérification et recevoir un reçu public.',
    'rewards': [
        {'id':'verified_official_source','label':'Ajouter une source officielle vérifiée','phi':5},
        {'id':'material_correction','label':'Corriger une erreur démontrée','phi':5},
        {'id':'verified_translation','label':'Traduire utilement une fiche avec relecture','phi':4},
        {'id':'local_language','label':'Documenter un mot, une expression ou une variante locale avec source/contexte','phi':4},
        {'id':'heritage_story','label':'Enrichir patrimoine, savoir-faire ou mémoire locale avec preuve','phi':4},
        {'id':'accessibility','label':'Améliorer l’accessibilité ou la compréhension','phi':3},
        {'id':'local_place_event','label':'Ajouter un lieu ou événement local vérifiable','phi':3},
    ],
    'anti_gaming': [
        'Pas de Φ pour une donnée copiée sans provenance.',
        'Pas de Φ pour volume, spam, opinion politique ou promotion commerciale.',
        'Une correction peut annuler un reçu erroné sans effacer l’historique.',
        'Les témoignages personnels doivent être étiquetés comme tels et ne deviennent pas des faits généraux.',
    ],
    'future_gate': 'Toute convertibilité, transférabilité, achat, avantage financier ou mécanisme de marché exigerait une décision séparée et une revue juridique dédiée.',
}
(ROOT/'docs/data/phi-coins-v1.json').write_text(json.dumps(phi, ensure_ascii=False, indent=2)+'\n')
print('TERRITORY_PROFILES',len(profiles))
print('PHI_REWARDS',len(phi['rewards']))
