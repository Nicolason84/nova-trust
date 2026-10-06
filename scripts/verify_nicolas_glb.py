#!/usr/bin/env python3
"""Independent GLB/source comparison. Does not invoke the exporter or write source."""
import ast,hashlib,json,re,struct
from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'docs/assets/nicolas-avatar/nicolas-canonical-v1.glb';blob=p.read_bytes()
magic,version,length=struct.unpack_from('<III',blob);assert magic==0x46546c67 and version==2 and length==len(blob)
size,kind=struct.unpack_from('<II',blob,12);assert kind==0x4e4f534a
g=json.loads(blob[20:20+size]);off=20+size;bs,bk=struct.unpack_from('<II',blob,off);assert bk==0x004e4942
binary=blob[off+8:];assert len(binary)==bs
native=Path('/Users/nicolasalonso/NOVA_DEV/SUPRA_REPRODUCIBLE_SOURCE_TRUTH_20261002/SUPRA/Resources/Nicolas.usda').read_text()
def source_array(k,s=native):return ast.literal_eval(re.search(re.escape(k)+r' = (\[.*?\])',s).group(1))
def read(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];fmt={5126:'f',5123:'H',5125:'I'}[a['componentType']]
 return struct.unpack_from('<'+fmt*a['count']*n,binary,v.get('byteOffset',0)+a.get('byteOffset',0))
paths=source_array('uniform token[] joints');assert [g['nodes'][i]['extras']['usdJointPath'] for i in g['skins'][0]['joints']]==paths
scale=1.75/1.808;global_positions=[]
for i,path in enumerate(paths):
 node=g['nodes'][i+1];t=node['translation'];parent=paths.index(path.rsplit('/',1)[0]) if '/' in path else None
 parentp=global_positions[parent] if parent is not None else [0,0,0];global_positions.append([a+b for a,b in zip(t,parentp)])
ibm=read(g['skins'][0]['inverseBindMatrices'])
for i,pos in enumerate(global_positions):assert all(abs(ibm[i*16+12+a]+pos[a])<1e-6 for a in range(3))
parts=re.split(r'    def Mesh "([^"]+)"',native)[1:];sources=dict(zip(parts[::2],parts[1::2]));y=[];total_triangles=0
for mesh in g['meshes']:
 part=sources[mesh['name']];attrs=mesh['primitives'][0]['attributes'];p0=source_array('point3f[] points',part);web=read(attrs['POSITION'])
 assert len(web)==3*len(p0)
 for i,(x,yy,z) in enumerate(p0):assert max(abs(web[i*3+a]-q) for a,q in enumerate([x*scale,(yy-.012)*scale,z*scale]))<2e-7
 y.extend(web[1::3]);assert list(read(attrs['JOINTS_0']))==source_array('int[] primvars:skel:jointIndices',part)
 assert max(abs(a-b) for a,b in zip(read(attrs['WEIGHTS_0']),source_array('float[] primvars:skel:jointWeights',part)))<1e-7
 for prim in mesh['primitives']:
  ix=read(prim['indices']);assert len(ix)%3==0 and max(ix)<len(p0);total_triangles+=len(ix)//3
assert abs(min(y))<1e-7 and abs(max(y)-1.75)<1e-7
assert total_triangles==50460
result={'status':'PASS','source_sha256':hashlib.sha256(native.encode()).hexdigest(),'glb_sha256':hashlib.sha256(blob).hexdigest(),'joints_preserved':40,'source_meshes':len(g['meshes']),'gltf_primitives':sum(len(m['primitives']) for m in g['meshes']),'height_m':max(y)-min(y),'floor_m':min(y),'triangles':total_triangles,'all_native_vertices_and_weights_compared':True,'inverse_bind_rest_consistent':True,'recognition_test':'NOT_PROVEN_BY_NUMERIC_TEST'}
(root/'PROOF/NICOLAS_GAMEHOUSE_V1_20261005/GLB_INDEPENDENT_VALIDATION.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
