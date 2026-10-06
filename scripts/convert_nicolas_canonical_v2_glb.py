#!/usr/bin/env python3
"""Bounded exporter for the recovered refined Nicolas USDA candidate.
Fail closed on unsupported transforms. No source mutation, replacement skeleton,
or second runtime; the browser-only face shell remains a reviewable derivative.
"""
import ast, hashlib, json, math, re, struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'docs/assets/nicolas-avatar/source-v2/Nicolas.usda'
SOURCE_ROLE='RECOVERED_REFINED_BODY_V2__SAME_40_JOINT_RIG'
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
# The approved frontal identity reference is cropped locally and person-masked
# without any external upload. It is mapped to a curved skinned facial shell,
# never a billboard or a plane. The original head remains behind the shell.
photo_path=PROOF/'avatar-v2/nicolas-face-cutout-v2.png'
photo=photo_path.read_bytes()
while len(binary)%4:binary.append(0)
off=len(binary);binary.extend(photo);g['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(photo)})
g['images']=[{'bufferView':len(g['bufferViews'])-1,'mimeType':'image/png','name':'NICOLAS_APPROVED_FRONT_CUTOUT_V2'}];g['textures']=[{'source':0}]
frameMat=len(g['materials']);g['materials'].append(dict(g['materials'][materials['metal']],name='aviator_frame'))
faceMat=len(g['materials']);g['materials'].append({'name':'reference_face_cutout_CURVED_SKINNED_V2','doubleSided':True,'alphaMode':'MASK','alphaCutoff':0.08,'pbrMetallicRoughness':{'baseColorTexture':{'index':0},'baseColorFactor':[1,1,1,1],'roughnessFactor':.72,'metallicFactor':0},'emissiveTexture':{'index':0},'emissiveFactor':[.11,.075,.055]})

# Source-space head profile after the canonical generator's head/rig shift.
# Values are bounded artistic reconstruction from the approved frontal image.
HEAD_PROFILE=[
 (1.500,.034,.044,-.004),(1.525,.047,.057,-.004),(1.555,.061,.069,-.005),
 (1.590,.072,.077,-.006),(1.625,.081,.083,-.008),(1.665,.085,.087,-.009),
 (1.705,.084,.087,-.010),(1.745,.079,.083,-.012),(1.780,.067,.071,-.014),
 (1.805,.050,.053,-.015),(1.820,.020,.024,-.016)
]
def profile(y):
 if y<=HEAD_PROFILE[0][0]:return HEAD_PROFILE[0][1:]
 if y>=HEAD_PROFILE[-1][0]:return HEAD_PROFILE[-1][1:]
 for a,b in zip(HEAD_PROFILE,HEAD_PROFILE[1:]):
  if a[0]<=y<=b[0]:
   t=(y-a[0])/(b[0]-a[0]);return tuple(a[k]+(b[k]-a[k])*t for k in range(1,4))
 raise AssertionError(y)
HEAD_MESHES={'Body_hair'}
def head_morph(x,y,z):
 # Preserve the 1.75 m crown while widening and shortening the stylized head.
 if 1.49<y<1.83:return x*1.27,1.82-(1.82-y)*.90,z*1.04
 return x,y,z
def shell_normals(points,indices):
 out=[[0.,0.,0.] for _ in points]
 for q in range(0,len(indices),3):
  ia,ib,ic=indices[q:q+3];a,b,c=points[ia],points[ib],points[ic]
  u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)]
  n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
  for i in (ia,ib,ic):
   for k in range(3):out[i][k]+=n[k]
 ans=[]
 for n in out:
  ln=max(1e-12,math.sqrt(sum(x*x for x in n)));n=[x/ln for x in n]
  if n[2]<0:n=[-x for x in n]
  ans.append(n)
 return ans
def face_shell():
 rows,cols=64,52;theta_max=1.34
 points=[];uv=[];indices=[]
 head_index=next(i for i,p in enumerate(joints) if p.endswith('/Head'))
 jaw_index=next(i for i,p in enumerate(joints) if p.endswith('/Jaw'))
 ji=[];jw=[]
 for j in range(rows+1):
  t=j/rows;y=1.815-(1.815-1.505)*t;rx,rz,cz=profile(y)
  for i in range(cols+1):
   u=i/cols;theta=(u-.5)*2*theta_max;c=max(.08,math.cos(theta));x=rx*math.sin(theta)
   z=cz+rz*c
   # Anatomical depth cues are deliberately bounded; texture carries identity.
   nose=(.011*math.exp(-((y-1.690)/.085)**2)+.035*math.exp(-((y-1.648)/.034)**2))*math.exp(-(x/.020)**2)
   brow=.0045*sum(math.exp(-((x-s*.038)/.020)**2) for s in (-1,1))*math.exp(-((y-1.696)/.020)**2)
   sockets=-.0048*sum(math.exp(-((x-s*.039)/.018)**2) for s in (-1,1))*math.exp(-((y-1.672)/.017)**2)
   cheeks=.0042*sum(math.exp(-((x-s*.041)/.027)**2) for s in (-1,1))*math.exp(-((y-1.625)/.040)**2)
   lips=.0048*math.exp(-(x/.031)**2)*math.exp(-((y-1.585)/.014)**2)
   chin=.0055*math.exp(-(x/.034)**2)*math.exp(-((y-1.545)/.024)**2)
   z+=(nose+brow+sockets+cheeks+lips+chin)*(c**1.35)+.0018
   x2,y2,z2=head_morph(x,y,z);points.append([x2,y2,z2]);uv.append([u,t])
   # Bottom rows get a small jaw influence while preserving the 40-joint rig.
   jaw=max(0.,min(.35,(1.575-y)/.07));ji.append([head_index,jaw_index,0,0]);jw.append([1-jaw,jaw,0,0])
 for j in range(rows):
  for i in range(cols):
   a=j*(cols+1)+i;b=a+1;c=a+cols+1;d=c+1
   indices.extend([a,c,b,b,c,d])
 return points,shell_normals(points,indices),ji,jw,uv,indices

shell_p,shell_n,shell_ji,shell_jw,shell_uv,shell_indices=face_shell()
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
 # Remove only redundant facial ornaments now carried by the approved texture.
 # The native cropped hair cap stays, and the mesh/node/skin lineage is unchanged.
 if name=='Body_hair':
  kept=[]
  for q in range(0,len(indices),3):
   tri=indices[q:q+3];facial=all(1.535<p[k][1]<1.735 and p[k][2]>.018 for k in tri)
   if not facial:kept.extend(tri)
  indices=kept
 if name=='Body_skin':
  kept=[]
  for q in range(0,len(indices),3):
   tri=indices[q:q+3]
   covered_by_shell=all(1.535<p[k][1]<1.825 and p[k][2]>.024 and abs(p[k][0])<.116 for k in tri)
   if not covered_by_shell:kept.extend(tri)
  indices=kept
 render_p=[];render_norm=[]
 for v,n in zip(p,norm):
  if name in HEAD_MESHES and 1.49<v[1]<1.83:
   render_p.append(head_morph(*v));q=[n[0]/1.27,n[1]/.90,n[2]/1.04];ln=max(1e-12,math.sqrt(sum(x*x for x in q)));render_norm.append([x/ln for x in q])
  else:render_p.append(v);render_norm.append(n)
 attrs={'POSITION':accessor([[x*scale,(y-ymin)*scale,z*scale] for x,y,z in render_p],'VEC3',target=34962,bounds=True),'NORMAL':accessor(render_norm,'VEC3',target=34962),'JOINTS_0':accessor([ji[i:i+4] for i in range(0,len(ji),4)],'VEC4',5123,34962),'WEIGHTS_0':accessor([jw[i:i+4] for i in range(0,len(jw),4)],'VEC4',target=34962)}
 mat=materials[re.search(r'material:binding = </Nicolas/Materials/(.*?)>',part).group(1)]
 other=[];frames=[]
 for q in range(0,len(indices),3):
  tri=indices[q:q+3]
  if name=='Body_metal' and all(p[k][1]>1.60 for k in tri):frames.extend(tri)
  else:other.extend(tri)
 prim=[]
 if other:prim.append({'attributes':attrs,'indices':accessor(other,'SCALAR',5123,34963),'material':mat})
 if frames:prim.append({'attributes':attrs,'indices':accessor(frames,'SCALAR',5123,34963),'material':frameMat})
 reference_faces=0
 if name=='Body_skin':
  shell_attrs={
   'POSITION':accessor([[x*scale,(y-ymin)*scale,z*scale] for x,y,z in shell_p],'VEC3',target=34962,bounds=True),
   'NORMAL':accessor(shell_n,'VEC3',target=34962),
   'JOINTS_0':accessor(shell_ji,'VEC4',5123,34962),
   'WEIGHTS_0':accessor(shell_jw,'VEC4',target=34962),
   'TEXCOORD_0':accessor(shell_uv,'VEC2',target=34962)
  }
  prim.append({'attributes':shell_attrs,'indices':accessor(shell_indices,'SCALAR',5123,34963),'material':faceMat})
  reference_faces=len(shell_indices)//3
 g['meshes'].append({'name':name,'primitives':prim})
 g['nodes'].append({'name':name,'mesh':len(g['meshes'])-1,'skin':0});g['nodes'][0]['children'].append(len(g['nodes'])-1)
 counts.append({'mesh':name,'vertices':len(p),'triangles':len(indices)//3,'curved_face_shell_triangles':reference_faces})
while len(binary)%4:binary.append(0)
g['buffers']=[{'byteLength':len(binary)}]
j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
glb=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary
OUT.mkdir(exist_ok=True);(OUT/'nicolas-canonical-v2.glb').write_bytes(glb)
report={'native_source':str(SOURCE),'source_role':SOURCE_ROLE,'native_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'native_height_m':ymax-ymin,'native_y_bounds':[ymin,ymax],'uniform_scale':scale,'web_height_m':1.75,'web_floor_m':0,'preserved_joint_paths':joints,'joint_count':40,'native_weights_preserved':True,'web_head_morph':{'x_scale':1.27,'y_scale':0.90,'z_scale':1.04,'crown_anchor_y':1.82,'scope':'CURVED_FACE_SHELL_AND_BODY_HAIR_ONLY_SOURCE_USDA_UNCHANGED'},'meshes':counts,'glb_sha256':hashlib.sha256(glb).hexdigest(),'glb_bytes':len(glb),'face_reference_sha256':hashlib.sha256(photo).hexdigest(),'face_reference_path':str(photo_path),'face_method':'Locally person-masked approved PNG on curved skinned facial shell; original head retained; no plane or billboard','animations':'Native Swift formulas ported at runtime, not embedded in USDA','status':'CONVERTED_CURVED_FACE_SHELL_V2_REQUIRES_VISUAL_APPROVAL','limits':['Single-view reconstruction remains artistic and requires human visual approval','Single frontal photograph cannot establish unseen profile geometry','70 kg is a visual reference, not measurable from a mesh']}
(PROOF/'NICOLAS_WEB_RIG_LINEAGE_V2.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'bytes':len(glb),'height':1.75,'bones':40,'meshes':len(meshes),'vertices':len(points),'triangles':sum(x['triangles'] for x in counts),'status':report['status']}))
