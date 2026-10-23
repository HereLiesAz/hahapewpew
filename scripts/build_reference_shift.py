"""Rebuild Shift faithfully from the owner's original artwork.

Usage: python scripts/build_reference_qwerty.py --out public/assets/characters/Qwerty_Rigged.glb
No source textures: every surface is independent skinned geometry with UVs and palette materials.
"""
import argparse, math, struct, json, os
from pathlib import Path
import numpy as np

# Indexed joints, kept compatible with Three.js animation and scene rig adapter.
BONES=[
 ('root',None,(0,0,0)),('spine','root',(0,.595,0)),('neck','spine',(0,.315,0)),('head','neck',(0,.025,0)),
 ('arm.L','spine',(-.208,.164,0)),('elbow.L','arm.L',(-.086,-.074,0)),('wrist.L','elbow.L',(-.040,-.083,0)),
 ('arm.R','spine',(.208,.164,0)),('elbow.R','arm.R',(.086,-.074,0)),('wrist.R','elbow.R',(.040,-.083,0)),
 ('hip.L','root',(-.085,.413,0)),('knee.L','hip.L',(-.008,-.116,0)),('ankle.L','knee.L',(-.006,-.110,.014)),
 ('hip.R','root',(.085,.413,0)),('knee.R','hip.R',(.008,-.116,0)),('ankle.R','knee.R',(.006,-.110,.014))
]
BONE_INDEX={n:i for i,(n,_,_) in enumerate(BONES)}
rest={}
for name,parent,xyz in BONES:
    rest[name]=np.array(xyz)+ (rest[parent] if parent else 0)
# True to the drawing: Qwerty's lower silhouette is exceptionally short.
# Compress legs more than the cylindrical body without changing head dimensions.
def stature_y(y):
    if y<=.44:return y*.50
    if y<=.85:return .22+(y-.44)*.68
    return y-(.85-(.22+(.85-.44)*.68))
raw_positions=rest.copy()
rest={name:np.array([xyz[0],stature_y(float(xyz[1])),xyz[2]]) for name,xyz in raw_positions.items()}
BONES=[(name,parent,tuple((rest[name]-rest[parent]).tolist()) if parent else tuple(rest[name].tolist())) for name,parent,_ in BONES]
# The rear pivot moves only upper shell; the sole remains fixed to the body.

PALETTE={
 'Dome_Graphite':('#777777',0),'Ink_Outline':('#080809',0),
 'Body_Graphite':('#4c4c4d',0),'Control_Light':('#92918f',0),
 'Limb_Black':('#090909',0),'Eyes_2D_Emission':('#ffffff',1),
}
DOME=[(.926,.704,.34),(.954,.720,.350),(1.,.723,.350),(1.088,.686,.342),
 (1.165,.618,.325),(1.245,.523,.297),(1.333,.398,.248),
 (1.396,.282,.188),(1.440,.164,.126),(1.463,.045,.060),(1.467,.003,.003)]
DOME=[(.926+(y-.926)*1.29,rx,rz) for y,rx,rz in DOME]
def front_depth(x,y,offset=0):
    for low,high in zip(DOME,DOME[1:]):
        if y<=high[0]:
            u=max(0,min(1,(y-low[0])/(high[0]-low[0])))
            rx=low[1]*(1-u)+high[1]*u
            rz=low[2]*(1-u)+high[2]*u
            break
    else:rx,rz=DOME[-1][1:]
    return rz*math.sqrt(max(0,1-(x/max(rx,.001))**2))+offset


def rgb(hexstr):
    h=hexstr.lstrip('#');return [int(h[k:k+2],16)/255 for k in (0,2,4)]

class Builder:
    def __init__(self):
        self.parts={name:[] for name in PALETTE}
    def add(self,mat,vertices,faces,joint,uv=None):
        vertices=np.asarray(vertices,dtype=np.float32)
        vertices[:,1]=np.array([stature_y(float(y)) for y in vertices[:,1]],dtype=np.float32)
        faces=np.asarray(faces,dtype=np.uint32)
        if uv is None:
            # Has valid UVs, but no textures. Geometry and colors take precedence.
            mins=vertices.min(axis=0); widths=np.maximum(vertices.max(axis=0)-mins,.0001)
            uv=np.stack([(vertices[:,0]-mins[0])/widths[0],(vertices[:,1]-mins[1])/widths[1]],axis=1).astype(np.float32)
        self.parts[mat].append((vertices,faces,np.asarray(uv,dtype=np.float32),int(BONE_INDEX[joint])))
    def prism(self,mat,poly,front_z,back_z,joint):
        n=len(poly);v=[]
        for z in (front_z,back_z):v += [[x,y,z] for x,y in poly]
        faces=[]
        for i in range(1,n-1):faces.extend([(0,i,i+1),(n,n+i+1,n+i)])
        for i in range(n):
            j=(i+1)%n;faces.extend([(i,j,n+j),(i,n+j,n+i)])
        self.add(mat,v,faces,joint)
    def disc(self,mat,x,y,z,r,joint,segments=48,flatten_y=1):
        v=[[x,y,z]]+[[x+math.cos(a*math.tau/segments)*r,y+math.sin(a*math.tau/segments)*r*flatten_y,z]for a in range(segments)]
        f=[(0,i+1,1+(i+1)%segments) for i in range(segments)]
        self.add(mat,v,f,joint)
    def cylinder(self,mat,base,top,r1,r2,joint,segments=16):
        p0=np.array(base,float);p1=np.array(top,float)
        vec=p1-p0;vec=vec/np.linalg.norm(vec)
        tangent=np.cross(vec, [0,0,1]);
        if np.linalg.norm(tangent)<.001:tangent=np.cross(vec,[0,1,0])
        tangent=tangent/np.linalg.norm(tangent);bitangent=np.cross(vec,tangent)
        v=[]
        for p,r in ((p0,r1),(p1,r2)):
            for i in range(segments):v.append((p+r*(math.cos(i*math.tau/segments)*tangent+math.sin(i*math.tau/segments)*bitangent)).tolist())
        f=[]
        for i in range(segments):
            j=(i+1)%segments;f.extend([(i,j,j+segments),(i,j+segments,i+segments)])
        for i in range(1,segments-1):f.extend([(0,i+1,i),(segments,segments+i,segments+i+1)])
        self.add(mat,v,f,joint)
    def polybox(self,mat,center,half,joint):
        x,y,z=center;rx,ry,rz=half
        verts=[(x-rx,y-ry,z+rz),(x+rx,y-ry,z+rz),(x+rx,y+ry,z+rz),(x-rx,y+ry,z+rz),
               (x-rx,y-ry,z-rz),(x+rx,y-ry,z-rz),(x+rx,y+ry,z-rz),(x-rx,y+ry,z-rz)]
        fs=[(0,1,2),(0,2,3),(5,4,7),(5,7,6),(4,0,3),(4,3,7),(1,5,6),(1,6,2),(3,2,6),(3,6,7),(4,5,1),(4,1,0)]
        self.add(mat,verts,fs,joint)
    def clamp(self,side):
        # Two substantial C-like clamp tips, not long finger silhouettes.
        sign=side
        x=sign*.325;y=.447
        j='wrist.L' if side<0 else 'wrist.R'
        self.cylinder('Limb_Black',(x-sign*.035,y+.030,.015),(x,y-.020,.015),.026,.031,j,8)
        self.cylinder('Limb_Black',(x,y-.014,.015),(x+sign*.045,y-.045,.034),.020,.016,j,8)
        self.cylinder('Limb_Black',(x+sign*.045,y-.045,.034),(x+sign*.048,y-.078,.058),.018,.012,j,8)
        self.cylinder('Limb_Black',(x,y-.010,.012),(x-sign*.018,y-.053,.045),.020,.014,j,8)

def build_character():
    b=Builder()
    # Continuous gray shell: the dome stays visibly gray from the rear, sides, and front.
    # Only the narrow base rim and eye outlines are black; no black rear hemisphere.
    n=60;v=[];uv=[];faces=[]
    for j,(y,rx,rz) in enumerate(DOME):
        for i in range(n+1):
            a=i*math.tau/n
            v.append([rx*math.cos(a),y,rz*math.sin(a)])
            uv.append([i/n,j/(len(DOME)-1)])
    for j in range(len(DOME)-1):
        for i in range(n):
            a=j*(n+1)+i;c=a+n+1
            faces.extend([(a,c,a+1),(a+1,c,c+1)])
    b.add('Dome_Side',v,faces,'head',np.asarray(uv,np.float32))
    half=36;v=[];uv=[];faces=[]
    for j,(y,rx,rz) in enumerate(DOME):
        for i in range(half+1):
            a=i*math.pi/half
            v.append([rx*math.cos(a)*.985,y,rz*math.sin(a)+.012])
            uv.append([i/half,j/(len(DOME)-1)])
    for j in range(len(DOME)-1):
        for i in range(half):
            a=j*(half+1)+i;c=a+half+1
            faces.extend([(a,c,a+1),(a+1,c,c+1)])
    b.add('Dome_Graphite',v,faces,'head',np.asarray(uv,np.float32))
    v=[];faces=[]
    for y in (.927,.944):
        for i in range(49):
            a=i*math.tau/48
            v.append([.715*math.cos(a),y,.345*math.sin(a)])
    for i in range(48):faces.extend([(i,i+1,i+49),(i+1,i+50,i+49)])
    b.add('Ink_Outline',v,faces,'head')
    # Both rigid 2D eyes are tessellated directly over the CURVED dome.
    # Neither sockets, eyelids nor independent eye bones exist.
    def eye(corners,mat,offset):
        (x0,y0),(x1,y1),(x2,y2),(x3,y3)=corners
        v=[];uv=[];tri=[];steps=12
        for j in range(steps+1):
            t=j/steps
            lx=x0+(x3-x0)*t;ly=y0+(y3-y0)*t
            rx=x1+(x2-x1)*t;ry=y1+(y2-y1)*t
            for i in range(steps+1):
                u=i/steps;x=lx+(rx-lx)*u;y=ly+(ry-ly)*u
                v.append([x,y,front_depth(x,y,offset)])
                uv.append([u,t])
        for j in range(steps):
            for i in range(steps):
                a=j*(steps+1)+i;c=a+steps+1
                tri.extend([(a,a+1,c),(a+1,c+1,c)])
        b.add(mat,v,tri,'head',np.asarray(uv,np.float32))
    for side in (-1,1):
        x=side*.351
        outer=[(x-.190,1.064-side*.020),(x+.174,1.097+side*.020),
            (x+.171,.955+side*.020),(x-.184,.936-side*.020)]
        inner=[(x-.151,1.037-side*.020),(x+.135,1.067+side*.020),
            (x+.135,.981+side*.020),(x-.148,.974-side*.020)]
        eye(outer,'Ink_Outline',.022)
        eye(inner,'Eyes_2D_Emission',.032)
    b.cylinder('Limb_Black',(0,.877,0),(0,.938,0),.055,.057,'neck',14)
    b.polybox('Ink_Outline',(0,.635,0),(.201,.261,.129),'spine')
    b.polybox('Body_Graphite',(0,.638,.012),(.182,.243,.119),'spine')
    b.polybox('Ink_Outline',(0,.617,.136),(.088,.133,.009),'spine')
    b.polybox('Control_Light',(0,.622,.144),(.061,.101,.004),'spine')
    for side in (-1,1):
        arm='arm.L' if side<0 else 'arm.R'
        elbow='elbow.L' if side<0 else 'elbow.R'
        wrist='wrist.L' if side<0 else 'wrist.R'
        b.cylinder('Limb_Black',(side*.18,.782,0),(side*.282,.685,.010),.016,.013,arm,10)
        b.cylinder('Limb_Black',(side*.282,.685,.010),(side*.337,.581,.025),.015,.011,elbow,10)
        x=side*.337;y=.580
        b.cylinder('Limb_Black',(x,y,.027),(x+side*.026,y-.028,.030),.021,.018,wrist,8)
        b.cylinder('Limb_Black',(x+side*.027,y-.028,.030),(x+side*.048,y-.069,.048),.015,.008,wrist,8)
        b.cylinder('Limb_Black',(x,y-.025,.025),(x-side*.025,y-.055,.046),.015,.008,wrist,8)
        hip='hip.L' if side<0 else 'hip.R'
        knee='knee.L' if side<0 else 'knee.R'
        ankle='ankle.L' if side<0 else 'ankle.R'
        b.cylinder('Limb_Black',(side*.084,.394,0),(side*.090,.296,0),.019,.015,hip,10)
        b.cylinder('Limb_Black',(side*.090,.296,0),(side*.100,.199,.018),.016,.013,knee,10)
        b.prism('Limb_Black',[(side*.113-.077,.124),(side*.113+.077,.124),
            (side*.113+.052,.209),(side*.113-.047,.209)],.170,-.047,ankle)
    return b


class GLBWriter:
    def __init__(self):self.data=bytearray();self.bufferViews=[];self.accessors=[]
    def view(self,data,target=None):
        while len(self.data)%4:self.data.append(0)
        offset=len(self.data);self.data+=bytes(data)
        v={'buffer':0,'byteOffset':offset,'byteLength':len(data)}
        if target:v['target']=target
        self.bufferViews.append(v);return len(self.bufferViews)-1
    def accessor(self,data,ctype,atype,target=None, minmax=False):
        data=np.ascontiguousarray(data)
        idx=len(self.accessors)
        v=self.view(data.tobytes(),target)
        entry={'bufferView':v,'componentType':ctype,'count':int(data.shape[0]),'type':atype}
        if minmax:
            entry['min']=np.min(data,axis=0).astype(float).tolist()
            entry['max']=np.max(data,axis=0).astype(float).tolist()
        self.accessors.append(entry);return idx
    def export(self,output,b):
        # A single mesh with multiple independently weighted material primitives.
        primitives=[]
        for name,blocks in b.parts.items():
            if not blocks:continue
            p,n,uv,joints,weights,faces=[],[],[],[],[],[];index=0
            for v,f,t,j in blocks:
                p.extend(v.tolist());uv.extend(t.tolist())
                joints.extend([[j,0,0,0]]*len(v));weights.extend([[1,0,0,0]]*len(v))
                # Face normals for sharp cel edges: keep corner splitting per triangle.
                # Vertices are split per triangle below so hard silhouettes don't smear.
                faces.extend((f+index).tolist());index+=len(v)
            p=np.asarray(p,np.float32);uv=np.asarray(uv,np.float32)
            joints=np.asarray(joints,np.uint16);weights=np.asarray(weights,np.float32)
            faces=np.asarray(faces,np.uint32)
            expanded=p[faces.reshape(-1)].reshape(-1,3)
            euv=uv[faces.reshape(-1)].reshape(-1,2)
            ej=joints[faces.reshape(-1)].reshape(-1,4)
            ew=weights[faces.reshape(-1)].reshape(-1,4)
            vec=expanded.reshape(-1,3,3)
            nr=np.cross(vec[:,1]-vec[:,0],vec[:,2]-vec[:,0]);nr/=np.maximum(np.linalg.norm(nr,axis=1,keepdims=True),1.e-8)
            normals=np.repeat(nr,3,axis=0).astype(np.float32)
            attrs={
                'POSITION':self.accessor(expanded,5126,'VEC3',34962,True),
                'NORMAL':self.accessor(normals,5126,'VEC3',34962),
                'TEXCOORD_0':self.accessor(euv,5126,'VEC2',34962),
                'JOINTS_0':self.accessor(ej,5123,'VEC4',34962),
                'WEIGHTS_0':self.accessor(ew,5126,'VEC4',34962),
            }
            # Non-indexed triangles are valid; skinned vertices are rigidly attached.
            primitives.append({'attributes':attrs,'material':list(PALETTE).index(name),'mode':4})
        nodes=[{'name':'Shift.mesh','mesh':0,'skin':0}]
        for name,parent,rel in BONES:
            node={'name':name,'translation':list(rel)}
            children=[i+1 for i,(n,par,_) in enumerate(BONES) if par==name]
            if children:node['children']=children
            nodes.append(node)
        # Correct world-to-joint inverse bind matrices in COLUMN-major form.
        ibms=np.array([np.array([[1,0,0,-pos[0]],[0,1,0,-pos[1]],[0,0,1,-pos[2]],[0,0,0,1]],np.float32).T.reshape(16) for name,_,_ in BONES for pos in [rest[name]]],np.float32)
        skin={'joints':list(range(1,len(BONES)+1)), 'skeleton':1, 'inverseBindMatrices':self.accessor(ibms,5126,'MAT4')}
        def rotate_x(angle):return [math.sin(angle/2),0,0,math.cos(angle/2)]
        def rotate_z(angle):return [0,0,math.sin(angle/2),math.cos(angle/2)]
        anims=[]
        def animation(name,channels):
            samplers=[];out=[]
            for target,path,times,values in channels:
                inp=self.accessor(np.array(times,np.float32),5126,'SCALAR')
                vals=np.array(values,np.float32)
                outp=self.accessor(vals,5126,'VEC4' if path=='rotation' else 'VEC3')
                samplers.append({'input':inp,'output':outp,'interpolation':'LINEAR'})
                out.append({'sampler':len(samplers)-1,'target':{'node':BONE_INDEX[target]+1,'path':path}})
            anims.append({'name':name,'samplers':samplers,'channels':out})
        t=[0,.32,.64,.96,1.28]
        animation('Shift_Walk',[(name,'rotation',t,[rotate_x(k*v) for k in [-1,0,1,0,-1]])
            for name,v in [('hip.L',.25),('hip.R',-.25),('arm.L',-.18),
                          ('arm.R',.18),('knee.L',.06),('knee.R',.06)]])
        animation('Shift_Idle',[('spine','rotation',[0,1.3,2.6],
            [rotate_z(0),rotate_z(.012),rotate_z(0)])])
        # No eye animation. Only a minute whole-head tilt during speech.
        animation('Shift_Talk',[('head','rotation',[0,.24,.49,.8,1.15],
            [rotate_z(0),rotate_z(-.036),rotate_z(0),rotate_z(.019),rotate_z(0)])])

        materials=[]
        for name,(color,emit) in PALETTE.items():
            mat={'name':'Shift/'+name,'pbrMetallicRoughness':{'baseColorFactor':rgb(color)+[1],'metallicFactor':0,'roughnessFactor':1},'doubleSided':True}
            if emit:mat.update({'emissiveFactor':rgb(color)})
            materials.append(mat)
        scene={'asset':{'version':'2.0','generator':'HereLiesAz reference-constrained rig builder'},
         'scene':0,'scenes':[{'nodes':[0,1]}],'nodes':nodes,'meshes':[{'name':'Shift skinned line-art','primitives':primitives}],
         'materials':materials,'skins':[skin],'animations':anims,
         'buffers':[{'byteLength':0}],'bufferViews':self.bufferViews,'accessors':self.accessors}
        while len(self.data)%4:self.data.append(0)
        scene['buffers'][0]['byteLength']=len(self.data)
        jsonbytes=json.dumps(scene,separators=(',',':')).encode()
        jsonbytes+=b' ' * (-len(jsonbytes)%4)
        glblen=12+8+len(jsonbytes)+8+len(self.data)
        with open(output,'wb') as f:
            f.write(struct.pack('<4sII',b'glTF',2,glblen))
            f.write(struct.pack('<I4s',len(jsonbytes),b'JSON'));f.write(jsonbytes)
            f.write(struct.pack('<I4s',len(self.data),b'BIN\x00'));f.write(self.data)
        return scene

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--out',default='Shift_Rigged.glb');args=ap.parse_args()
    b=build_character();p=Path(args.out);p.parent.mkdir(parents=True,exist_ok=True)
    a=GLBWriter().export(p,b)
    print(p,'bytes',p.stat().st_size,'bones',len(BONES),'material primitives',len(a['meshes'][0]['primitives']),'animations',len(a['animations']))