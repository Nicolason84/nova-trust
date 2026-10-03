import copy
import json
import tempfile
import unittest
from pathlib import Path
from france_topology_detail import compile_detail, validate_detail

class DetailTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        self.regions=[{'code':'32','nom':'Hauts-de-France'}]
        self.deps=[{'code':'60','nom':'Oise','codeRegion':'32'},{'code':'02','nom':'Aisne','codeRegion':'32'}]
        self.epcis=[{'code':'200068047','nom':'Intercommunalité de test','codesRegions':['32'],'codesDepartements':['60','02'],'population':30}]
        self.communes=[{'code':'60463','nom':'Commune A','codeDepartement':'60','codeRegion':'32','codeEpci':'200068047','population':10,'centre':{'coordinates':[2.46,49.27]},'codesPostaux':['60180'],'siren':'216004580','surface':1.2},
                       {'code':'02001','nom':'Commune B','codeDepartement':'02','codeRegion':'32','codeEpci':'200068047','population':20,'centre':{'coordinates':[3.0,49.0]},'codesPostaux':['02000'],'siren':'200000000','surface':2.0}]
        self.codes={'60463','02001'}
    def tearDown(self):self.temp.cleanup()
    def make(self):return compile_detail(self.regions,self.deps,self.epcis,self.communes,self.codes,[{'url':'https://geo.api.gouv.fr/communes'}],'2026-10-03T20:00:00Z',self.root)
    def test_index_shards_have_exact_coverage(self):
        d=self.make();r=validate_detail({'detail':d},self.root);self.assertEqual(r['communes_cog'],2);self.assertEqual(r['shards'],2)
    def test_content_address_is_stable(self):
        a=self.make();b=self.make();self.assertEqual(a['snapshot_id'],b['snapshot_id']);self.assertEqual(a['shards'],b['shards'])
    def test_population_epoch_never_invented(self):self.assertEqual(self.make()['population_vintage'],'NOT_PROVIDED_BY_THIS_API_RESPONSE')
    def test_cross_department_epci_is_not_forced_to_one_parent(self):self.assertEqual(self.make()['epcis'][0]['member_department_codes'],['02','60'])
    def test_missing_population_is_not_zero(self):
        self.communes[0]['population']=None;d=self.make();file=self.root/d['shards']['60']['path'].removeprefix('data/');self.assertIsNone(json.loads(file.read_text())['communes'][0]['population'])
    def test_missing_epci_is_explicit(self):
        self.communes[0].pop('codeEpci');self.assertIsNone(self.make()['commune_index'][1][4])
    def test_unknown_epci_is_reported(self):
        self.communes[0]['codeEpci']='123456789';self.assertEqual(len(self.make()['unresolved_epci_links']),1)
    def test_duplicate_commune_blocks(self):
        self.communes.append(copy.deepcopy(self.communes[0]));self.assertRaises(ValueError,self.make)
    def test_wrong_region_blocks(self):
        self.communes[0]['codeRegion']='11';self.assertRaises(ValueError,self.make)
    def test_missing_cog_commune_blocks(self):
        self.codes.add('60999');self.assertRaises(ValueError,self.make)
    def test_non_cog_record_is_excluded(self):
        self.communes.append({'code':'60999','nom':'Excluded'});self.assertEqual(self.make()['counts']['communes_cog'],2)
    def test_unsafe_code_blocks(self):
        self.deps[0]['code']='../60';self.assertRaises(ValueError,self.make)
    def test_digest_mismatch_blocks(self):
        d=self.make();path=self.root/d['shards']['60']['path'].removeprefix('data/');path.write_text('{}');self.assertRaises(ValueError,validate_detail,{'detail':d},self.root)
    def test_old_immutable_shard_not_overwritten(self):
        a=self.make();p=self.root/a['shards']['60']['path'].removeprefix('data/');before=p.read_bytes();self.communes[0]['population']=11;b=self.make();self.assertNotEqual(a['shards']['60']['path'],b['shards']['60']['path']);self.assertEqual(p.read_bytes(),before)
    def test_nan_never_written(self):
        self.communes[0]['surface']=float('nan');d=self.make();p=self.root/d['shards']['60']['path'].removeprefix('data/');self.assertNotIn('NaN',p.read_text())
    def test_out_of_range_geography_is_unknown(self):
        self.communes[0]['centre']['coordinates']=[222,490];d=self.make();p=self.root/d['shards']['60']['path'].removeprefix('data/');self.assertIsNone(json.loads(p.read_text())['communes'][0]['center'])

if __name__=='__main__':unittest.main(verbosity=2)
