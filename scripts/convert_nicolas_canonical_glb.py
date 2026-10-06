#!/usr/bin/env python3
"""Bounded exporter for this canonical USDA. Fail closed on unsupported transforms.
No canonical source mutation. No replacement skeleton or generated body geometry.
"""
import ast, hashlib, json, math, re, struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path('/Users/nicolasalonso/NOVA_DEV/SUPRA_REPRODUCIBLE_SOURCE_TRUTH_20261002/SUPRA/Resources/Nicolas.usda')
OUT=ROOT/'docs/assets/nicolas-avatar'
PROOF=ROOT/'PROOF/NICOLAS_GAMEHOUSE_V1_20261005'
s=SOURCE.read_text()
def array(text,key):
 m=re.search(re.escape(key)+r' = (\[.*?\])',text)
 assert m,key
 return ast.literal_eval(m.group(1))
joints=array(s,'uniform token[] joints');rest=array(s,'uniform matrix4d[] restTransforms');bind=array(s,'uniform matrix4d[] bindTransforms')
assert len(joints)==len(rest)==len(bind)==40
parts=re.split(r'    def Mesh "([^"]+)"',s)[1:]
meshes=[(parts[i],parts[i+1]) for i in range(0,len(parts),2)]
points=[p for name,part in meshes for p in array(part,'point3f[] points')]
ymin=min(p[1] for p in points);ymax=max(p[1] for p in points);scale=1.75/(ymax-ymin)
g={'asset':{'version':'2.0','generator':'SUPRA canonical USDA exporter V1'},'scene':0,'scenes':[{'nodes':[0]}], 'nodes':[{'name':'NicolasCanonical','children':[],'extras':{'native_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'height_m':1.75,'identity_status':'WEB_PREVIEW_REQUIRES_VISUAL_APPROVAL'}}], 'meshes':[],'materials':[],'skins':[],'accessors':[],'bufferViews':[],'buffers':[]}
binary=bytearray()
def accessor(values,typ,ctype=5126,target=None,bounds=False):
 n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[typ]
 flat=values if n==1 else [x for row in values for x in row]
 while len(binary)%4:binary.append(0)
 offset=len(binary);fmt={5126:'f',5123:'H',5125:'I'}[ctype]
 binary.extend(struct.pack('<'+fmt*len(flat),*flat))
 view={'buffer':0,'byteOffset':offset,'byteLength':len(binary)-offset}
 if target:view['target']=target
 g['bufferViews'].append(view)
 a={'bufferView':len(g['bufferViews'])-1,'componentType':ctype,'count':len(flat)//n,'type':typ}
 if bounds:a.update(min=[min(flat[i::n]) for i in range(n)],max=[max(flat[i::n]) for i in range(n)])
 g['accessors'].append(a);return len(g['accessors'])-1
for i,path in enumerate(joints):
 m=rest[i]
 assert all(abs(m[a][b]-(1 if a==b else 0))<1e-7 for a in range(3) for b in range(4))
 t=[m[3][a]*scale for a in range(3)]
 if i==0:t[1]-=ymin*scale
 node={'name':path.split('/')[-1],'translation':t,'extras':{'usdJointPath':path}}
 g['nodes'].append(node)
for i,path in enumerate(joints):
 parent=joints.index(path.rsplit('/',1)[0])+1 if '/' in path else 0
 g['nodes'][parent].setdefault('children',[]).append(i+1)
inverse=[]
for m in bind:
 x,y,z=[m[3][a]*scale for a in range(3)];y-=ymin*scale
 inverse.append([1,0,0,0,0,1,0,0,0,0,1,0,-x,-y,-z,1])
g['skins']=[{'name':'NicolasNative40','joints':list(range(1,41)),'skeleton':1,'inverseBindMatrices':accessor(inverse,'MAT4')}]
materials={}
for m in re.finditer(r'def Material "([^"]+)"(.*?)(?=def Material|def Mesh)',s,re.S):
 name,part=m.groups();color=ast.literal_eval(re.search(r'inputs:diffuseColor = (\(.*?\))',part).group(1))
 metal=float(re.search(r'inputs:metallic = ([\d.]+)',part).group(1));rough=float(re.search(r'inputs:roughness = ([\d.]+)',part).group(1))
 materials[name]=len(g['materials']);g['materials'].append({'name':name,'doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':[*color,1],'metallicFactor':metal,'roughnessFactor':rough}})
# The supplied frontal reference is embedded unchanged. UVs attach it to actual
# native facial triangles. It is never a plane, sprite, or replacement head.
photo=Path('/Users/nicolasalonso/Pictures/Photos Library.photoslibrary/resources/derivatives/E/E95D2A13-C567-4D41-860A-E27FD67D37E2_1_105_c.jpeg').read_bytes()
while len(binary)%4:binary.append(0)
off=len(binary);binary.extend(photo);g['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(photo)})
g['images']=[{'bufferView':len(g['bufferViews'])-1,'mimeType':'image/jpeg','name':'REF_C_front_without_glasses'}];g['textures']=[{'source':0}]
frameMat=len(g['materials']);g['materials'].append(dict(g['materials'][materials['metal']],name='aviator_frame'))
faceMat=len(g['materials']);g['materials'].append({'name':'reference_face_projection_WEB_PREVIEW','doubleSided':True,'pbrMetallicRoughness':{'baseColorTexture':{'index':0},'roughnessFactor':.86,'metallicFactor':0}})
counts=[]
for name,part in meshes:
 p=array(part,'point3f[] points');norm=array(part,'normal3f[] normals');indices=array(part,'int[] faceVertexIndices');counts0=array(part,'int[] faceVertexCounts');ji=array(part,'int[] primvars:skel:jointIndices');jw=array(part,'float[] primvars:skel:jointWeights')
 assert len(norm)==len(p) and len(ji)==len(jw)==4*len(p)
 assert sum(counts0)==len(indices)
 triangles=[];cursor=0
 for count in counts0:
  polygon=indices[cursor:cursor+count];cursor+=count
  for k in range(1,count-1):triangles.extend([polygon[0],polygon[k],polygon[k+1]])
 indices=triangles
 assert all(0<=i<40 for i in ji) and max(indices)<len(p)
 assert all(abs(sum(jw[i:i+4])-1)<1e-5 for i in range(0,len(jw),4))
 for i in range(3):assert f'xformOp:' not in part
 attrs={'POSITION':accessor([[x*scale,(y-ymin)*scale,z*scale] for x,y,z in p],'VEC3',target=34962,bounds=True),'NORMAL':accessor(norm,'VEC3',target=34962),'JOINTS_0':accessor([ji[i:i+4] for i in range(0,len(ji),4)],'VEC4',5123,34962),'WEIGHTS_0':accessor([jw[i:i+4] for i in range(0,len(jw),4)],'VEC4',target=34962)}
 mat=materials[re.search(r'material:binding = </Nicolas/Materials/(.*?)>',part).group(1)]
 front=[];other=[];frames=[]
 for i in range(0,len(indices),3):
  tri=indices[i:i+3]
  face=name=='Body_skin' and all(1.565<p[k][1]<1.795 and p[k][2]>.02 and abs(p[k][0])<.108 for k in tri)
  if name=='Body_metal' and all(p[k][1]>1.60 for k in tri):frames.extend(tri)
  else:(front if face else other).extend(tri)
 prim=[]
 if other:prim.append({'attributes':attrs,'indices':accessor(other,'SCALAR',5123,34963),'material':mat})
 if frames:prim.append({'attributes':attrs,'indices':accessor(frames,'SCALAR',5123,34963),'material':frameMat})
 if front:
  uv=[[.49+x*1.65,.385-(y-1.55)*1.14] for x,y,z in p]
  prim.append({'attributes':dict(attrs,TEXCOORD_0=accessor(uv,'VEC2',target=34962)),'indices':accessor(front,'SCALAR',5123,34963),'material':faceMat})
 g['meshes'].append({'name':name,'primitives':prim})
 g['nodes'].append({'name':name,'mesh':len(g['meshes'])-1,'skin':0});g['nodes'][0]['children'].append(len(g['nodes'])-1)
 counts.append({'mesh':name,'vertices':len(p),'triangles':len(indices)//3,'reference_face_triangles':len(front)//3})
while len(binary)%4:binary.append(0)
g['buffers']=[{'byteLength':len(binary)}]
j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
glb=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary
OUT.mkdir(exist_ok=True);(OUT/'nicolas-canonical-v1.glb').write_bytes(glb)
report={'native_source':str(SOURCE),'native_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'native_height_m':ymax-ymin,'native_y_bounds':[ymin,ymax],'uniform_scale':scale,'web_height_m':1.75,'web_floor_m':0,'preserved_joint_paths':joints,'joint_count':40,'native_weights_preserved':True,'meshes':counts,'glb_sha256':hashlib.sha256(glb).hexdigest(),'glb_bytes':len(glb),'face_reference_sha256':hashlib.sha256(photo).hexdigest(),'face_method':'UV projection on native skinned facial triangles; reference JPEG unedited; no billboard','animations':'Native Swift formulas ported at runtime, not embedded in USDA','status':'CONVERTED_SKINNED_WEB_PREVIEW_NOT_FINAL','limits':['Native geometry is stylized; likeness and realism require human review','Single frontal photograph cannot establish unseen profile geometry','70 kg is a visual reference, not measurable from a mesh']}
(PROOF/'NICOLAS_WEB_RIG_LINEAGE_V1.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'bytes':len(glb),'height':1.75,'bones':40,'meshes':len(meshes),'vertices':len(points),'triangles':sum(x['triangles'] for x in counts),'status':report['status']}))
