#!/usr/bin/env python3
"""Author UV-mapped, skinned GLB character assets (local-only Pillow/numpy dependencies).
Every character is a distinct textured surface mesh with an actual glTF armature.
The geometry is authored by anatomical/drapery/industrial contours, rather than
scene-time primitive meshes.  Exports remain editable in Blender or other DCCs.
"""
import io, json, math, os, struct, random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

DEST=Path(__file__).resolve().parents[1]/'public'/'assets'/'models'; DEST.mkdir(parents=True,exist_ok=True)
S=math.sin; C=math.cos; PI=math.pi

def tex(kind,seed):
    r=random.Random(seed); w=h=512
    colors={'skin':(159,118,94),'dress':(65,73,78),'dress_dark':(38,45,48),'card':(128,101,64),'face':(138,108,69),'metal':(74,76,75),'steel':(110,114,111),'rust':(85,55,44),'rubber':(23,26,27),'glass':(18,25,30),'light':(209,215,202),'bear':(76,49,34)}
    base=colors[kind]; arr=np.zeros((h,w,3),dtype=np.uint8)
    # Physical microvariation plus large-scale irregular staining; avoid tiled white noise alone.
    coarse=np.random.default_rng(seed).normal(0,1,(32,32)).astype('float32')
    coarse=np.asarray(Image.fromarray(coarse,mode='F').resize((w,h),Image.Resampling.BICUBIC));
    fine=np.random.default_rng(seed+100).normal(0,1,(h,w))
    yy,xx=np.mgrid[0:h,0:w]
    for z in range(3):
        grain=coarse*6.8+fine*2.4
        if kind.startswith('dress'):
            grain += ((xx%5)<2)*2.2+((yy%7)<2)*1.6
        if kind in ['card','face']:
            grain += (np.sin(xx*.46)+np.sin(xx*1.8)) *2.8
        if kind in ['steel','metal','rust']:
            grain += 2*np.sin(yy*.16)
        arr[:,:,z]=np.clip(base[z]+grain,0,255).astype('uint8')
    im=Image.fromarray(arr,'RGB'); d=ImageDraw.Draw(im,'RGBA')
    if kind in ['steel','metal','rust','card','face']:
        for _ in range(240):
            x=r.randrange(w);y=r.randrange(h); dx=r.randrange(2,70)
            color=(210,198,169,r.randrange(9,35)) if kind not in ['card','face'] else (49,33,19,r.randrange(8,32))
            d.line((x,y,x+dx,y+r.randrange(-3,4)),fill=color,width=r.choice([1,1,2]))
        for _ in range(32):
            x=r.randrange(w);y=r.randrange(h); rx=r.randrange(8,45);ry=r.randrange(5,25)
            d.ellipse((x-rx,y-ry,x+rx,y+ry),fill=((39,28,21,19) if kind in ['card','face'] else (85,36,20,27)))
    if kind=='skin':
        for _ in range(360):
            x=r.randrange(w);y=r.randrange(h);rad=r.choice([1,1,2,3]);d.ellipse((x,y,x+rad,y+rad),fill=(86,55,43,r.randrange(9,32)))
    if kind.startswith('dress'):
        for _ in range(160):
            x=r.randrange(w);y=r.randrange(h);d.line((x,y,x+r.randrange(-2,3),y+r.randrange(15,65)),fill=(15,17,20,r.randrange(5,23)))
    if kind=='face':
        # Printed face is weathered IN the cardboard texture, not stuck-on glowing stickers.
        ink=(29,25,21,247)
        d.line((92,148,194,177),fill=ink,width=10)
        d.line((306,177,408,148),fill=ink,width=10)
        d.ellipse((130,181,158,218),fill=ink);d.ellipse((349,181,377,218),fill=ink)
        d.line((96,150,190,181),fill=ink,width=7);d.line((310,181,405,150),fill=ink,width=7)
        d.rectangle((150,272,368,355),outline=ink,width=9)
        for x in range(178,366,27):d.line((x,273,x,353),fill=ink,width=3)
        d.line((152,310,368,310),fill=ink,width=4)
        # faded flecks where the ink rubbed off
        for _ in range(450):
            x=r.randrange(512);y=r.randrange(512)
            if (65<x<440 and 105<y<395) and r.random()<.3:
                d.rectangle((x,y,x+r.randrange(1,4),y+1),fill=(170,136,87,r.randrange(50,180)))
    im=im.filter(ImageFilter.GaussianBlur(.25)); b=io.BytesIO(); im.save(b,format='PNG',optimize=True);return b.getvalue()

TEXTURES={k:tex(k,110+i*19) for i,k in enumerate(['skin','dress','dress_dark','card','face','metal','steel','rust','rubber','glass','light','bear'])}

def normalize(v):
    v=np.asarray(v,dtype=float);l=np.linalg.norm(v);return v/l if l>1e-8 else v

class Mesh:
    def __init__(self,material,bone):self.mat=material;self.bone=bone;self.v=[];self.uv=[];self.faces=[];self.weights=[]
    def rings(self,profiles,segments=32,ruffle=0,waves=9,phase=0,twist=0):
        start=len(self.v)
        for j,(y,rx,rz,cx,cz) in enumerate(profiles):
            for i in range(segments+1):
                a=2*PI*i/segments
                t=j/(len(profiles)-1)
                perturb=1+ruffle*(.67*S(waves*a+phase+1.1*t)+.23*S((waves+5)*a-2*t))
                self.v.append((cx+rx*C(a)*perturb,y+.004*ruffle*S(waves*a+2*t),cz+rz*S(a)*perturb))
                self.uv.append((i/segments,t))
                self.weights.append(self.bone)
        for j in range(len(profiles)-1):
            for i in range(segments):
                a=start+j*(segments+1)+i;b=a+segments+1
                self.faces.extend([(a,b,a+1),(a+1,b,b+1)])
        return self
    def ellipsoid(self,c,dimensions,seg=26,rings=16):
        start=len(self.v)
        for j in range(rings+1):
            theta=PI*j/rings
            for i in range(seg+1):
                a=2*PI*i/seg
                self.v.append((c[0]+dimensions[0]*S(theta)*C(a),c[1]+dimensions[1]*C(theta),c[2]+dimensions[2]*S(theta)*S(a)))
                self.uv.append((i/seg,j/rings));self.weights.append(self.bone)
        for j in range(rings):
            for i in range(seg):
                a=start+j*(seg+1)+i;b=a+seg+1
                self.faces.extend([(a,a+1,b),(a+1,b+1,b)])
        return self
    def loftpath(self,pts,radii,seg=16):
        pts=np.array(pts,float)
        if len(radii)!=len(pts):raise ValueError('radius mismatch')
        start=len(self.v)
        for j,(p,r) in enumerate(zip(pts,radii)):
            tangent=normalize(pts[min(j+1,len(pts)-1)]-pts[max(0,j-1)])
            if np.linalg.norm(tangent)<1e-5:tangent=np.array([0,1,0.])
            n=normalize(np.cross(tangent,[0,0,1]) if abs(tangent[2])<.85 else np.cross(tangent,[1,0,0]))
            b=np.cross(tangent,n)
            for i in range(seg+1):
                a=2*PI*i/seg;q=p+r*(C(a)*n+S(a)*b)
                self.v.append(q.tolist());self.uv.append((i/seg,j/(len(pts)-1)));self.weights.append(self.bone)
        for j in range(len(pts)-1):
            for i in range(seg):
                a=start+j*(seg+1)+i;b=a+seg+1
                self.faces.extend([(a,b,a+1),(a+1,b,b+1)])
        return self
    def panel(self,center,size,bev=0,thickness=None):
        # Beveled housing/panel: cross sections along local Z, with separate bevel lip.
        x,y,z=center; w,h,d=size
        if thickness is None: thickness=d
        bevel=min(bev,w*.35,h*.35)
        # Each face has physically meaningful profile, not a single box primitive.
        rings=[(z-d/2,w-2*bevel,h-2*bevel),(z-d/2+bevel,w,h),(z+d/2-bevel,w,h),(z+d/2,w-2*bevel,h-2*bevel)] if bevel>0 else [(z-d/2,w,h),(z+d/2,w,h)]
        start=len(self.v)
        for k,(depth,width,height) in enumerate(rings):
            for a,b in [(-1,-1),(1,-1),(1,1),(-1,1)]:
                self.v.append((x+a*width/2,y+b*height/2,depth));self.uv.append(((a+1)*.5,(b+1)*.5));self.weights.append(self.bone)
        for k in range(len(rings)-1):
            for i in range(4):
                a=start+k*4+i;b=start+k*4+(i+1)%4;c=b+4;d=a+4
                self.faces.extend([(a,b,c),(a,c,d)])
        self.faces.extend([(start,start+2,start+1),(start,start+3,start+2)])
        last=start+(len(rings)-1)*4
        self.faces.extend([(last,last+1,last+2),(last,last+2,last+3)])
        return self
    def quad(self,points):
        n=len(self.v)
        self.v.extend(points);self.uv.extend([(0,0),(1,0),(1,1),(0,1)]);self.weights.extend([self.bone]*4)
        self.faces.extend([(n,n+1,n+2),(n,n+2,n+3)]);return self

class Character:
 def __init__(self,name,unit):
    self.name=name;self.meshes=[];self.bones=[];self.bone_lookup={};self.unit=unit
 def bone(self,name,parent,pos):
    idx=len(self.bones);self.bones.append((name,parent,list(pos)));self.bone_lookup[name]=idx;return idx
 def mesh(self,mat,bone):
    m=Mesh(mat,self.bone_lookup[bone]);self.meshes.append(m);return m
 def surface(self,mat,bone,profiles,n=32,ruffle=0,waves=9):
    return self.mesh(mat,bone).rings(profiles,n,ruffle,waves)
 def blob(self,mat,bone,pos,dim):
    return self.mesh(mat,bone).ellipsoid(pos,dim)
 def tube(self,mat,bone,pts,radii):
    return self.mesh(mat,bone).loftpath(pts,radii)
 def plate(self,mat,bone,pos,dim,bev=0):
    return self.mesh(mat,bone).panel(pos,dim,bev)


def skeleton(c,humanoid):
    if humanoid:
        cfg=[('Root',None,(0,0,0)),('Pelvis','Root',(0,.79,0)),('Spine','Pelvis',(0,.35,0)),('Neck','Spine',(0,.36,0)),('Head','Neck',(0,.18,0))]
        for a in [-1,1]:
            side='L' if a<0 else 'R'
            cfg += [(side+'UpperArm','Spine',(a*.255,.21,0)),(side+'LowerArm',side+'UpperArm',(a*.055,-.29,0)),(side+'Hand',side+'LowerArm',(a*.017,-.255,0)),(side+'UpperLeg','Pelvis',(a*.155,-.06,0)),(side+'LowerLeg',side+'UpperLeg',(a*.012,-.35,0)),(side+'Foot',side+'LowerLeg',(0,-.305,.035))]
    else:
        cfg=[('Root',None,(0,0,0)),('Pelvis','Root',(0,.31,0)),('Spine','Pelvis',(0,.155,0)),('Neck','Spine',(0,.16,0)),('Head','Neck',(0,.17,0)),('Gun','Spine',(.30,.045,.18)),('Barrel','Gun',(.30,0,0))]
        for a in [-1,1]:
            side='L' if a<0 else 'R'
            cfg += [(side+'UpperArm','Spine',(a*.185,.105,0)),(side+'LowerArm',side+'UpperArm',(a*.025,-.19,0)),(side+'Hand',side+'LowerArm',(a*.02,-.15,0)),(side+'UpperLeg','Pelvis',(a*.135,-.035,0)),(side+'LowerLeg',side+'UpperLeg',(a*.01,-.14,0)),(side+'Foot',side+'LowerLeg',(0,-.13,.025))]
    for name,parent,pos in cfg:c.bone(name,parent,pos)


def tab():
 c=Character('Tab',1);skeleton(c,True)
 # Stretched, softly asymmetric clothed body: shoulders, waist, full skirt, individually sculpted pleats.
 c.surface('skin','Spine',[(.96,.13,.10,0,.0),(1.14,.16,.12,0,.0),(1.30,.17,.11,0,.0),(1.38,.105,.095,0,0)],40)
 c.surface('dress','Spine',[(1.04,.18,.14,0,0),(1.10,.205,.17,0,0),(1.22,.22,.16,0,.015),(1.30,.195,.15,0,.0),(1.39,.17,.12,0,0)],48,.035)
 profiles=[]
 for j in range(30):
    t=j/29; y=1.10-t*.57; rx=.18+.22*(t**1.4);rz=.15+.14*t
    profiles.append((y,rx,rz,.006*S(t*9),0))
 c.surface('dress','Pelvis',profiles,84,.085,13)
 # cloth front pleat boundaries and torn hem piping
 for k in range(19):
    a=2*PI*k/19
    tpts=[]
    for q in range(13):
        t=q/12; rr=.18+.22*t**1.4
        tpts.append((C(a)*rr*(1+.07*S(t*11+k)),1.09-t*.57,.01+S(a)*(.15+.14*t)))
    c.tube('dress_dark','Pelvis',tpts,[.0013]*13)
 for a in [-1,1]:
    side='L' if a<0 else 'R';up=side+'UpperArm';lo=side+'LowerArm';hand=side+'Hand';thigh=side+'UpperLeg';shin=side+'LowerLeg';foot=side+'Foot'
    c.blob('skin',up,(a*.264,1.31,0),(.080,.09,.079))
    c.tube('skin',up,[(a*.275,1.30,0),(a*.286,1.20,-.007),(a*.32,1.06,-.02)],[.075,.066,.045])
    c.blob('skin',lo,(a*.32,1.045,-.02),(.048,.056,.051))
    c.tube('skin',lo,[(a*.322,1.04,-.02),(a*.33,.89,-.025),(a*.34,.80,0)],[.047,.04,.03])
    c.blob('skin',hand,(a*.35,.755,0),(.042,.07,.036))
    for f in range(4):
        xx=a*.35+(f-1.5)*.024
        c.tube('skin',hand,[(xx,.714,.008),(xx+.004,.657+.005*abs(f-1.5),.025)], [.009,.007])
    c.tube('skin',hand,[(a*.390,.75,0),(a*.418,.68,.05)],[.016,.011])
    c.tube('skin',thigh,[(a*.15,.74,0),(a*.17,.64,0),(a*.17,.49,0),(a*.16,.40,0)],[.082,.092,.080,.069])
    c.blob('skin',shin,(a*.16,.385,0),(.066,.068,.065))
    c.tube('skin',shin,[(a*.16,.39,0),(a*.155,.28,0),(a*.15,.16,-.005),(a*.15,.10,.0)],[.065,.06,.052,.048])
    c.tube('dress_dark',shin,[(a*.15,.172,0),(a*.15,.155,0),(a*.15,.116,0)],[.060,.059,.055])
    c.blob('rubber',foot,(a*.15,.068,.082),(.105,.063,.158))
    c.plate('dress_dark',foot,(a*.15,.086,.165),(.135,.012,.11),.007)
    for z in [.084,.113,.142]:c.tube('dress_dark',foot,[(a*.15-.06,.124,z),(a*.15+.06,.124,z)],[.004,.004])
 # Neck and visible hair at edges of the cardboard.
 c.surface('skin','Neck',[(1.43,.055,.056,0,0),(1.54,.060,.054,0,0)],24)
 c.blob('dress_dark','Head',(0,1.57,0),(.17,.15,.16))
 # Structural cardboard shell: separate folding walls with visible thickness/flaps, printed face.
 half=.295; bottom=1.46;top=2.02
 for a in [-1,1]:
    # shell side panels slight warps; front surface always faces +Z
    x=a*half
    c.mesh('card','Head').quad([(x,bottom,-half),(x,bottom,half),(x,top,half),(x,top,-half)] if a>0 else [(x,bottom,half),(x,bottom,-half),(x,top,-half),(x,top,half)])
    c.mesh('card','Head').quad([(-half,bottom,a*half),(half,bottom,a*half),(half,top,a*half),(-half,top,a*half)])
 front=c.mesh('face','Head').quad([(-half+.005,bottom+.012,half+.003),(half-.005,bottom+.012,half+.003),(half-.005,top-.008,half+.003),(-half+.005,top-.008,half+.003)])
 front.uv[:]=[(0,1),(1,1),(1,0),(0,0)]
 c.plate('card','Head',(0,top,.0),(.59,.017,.59),.006)
 for a in [-1,1]:
    c.plate('card','Head',(a*.20,bottom-.04,.0),(.29,.022,.62),.006)
    c.plate('card','Head',(0,bottom-.04,a*.28),(.61,.022,.19),.006)
    for z in [-.295,.295]:c.tube('dress_dark','Head',[(a*.297,bottom,z),(a*.297,top,z)],[.003,.003])
 c.plate('dress_dark','Head',(0,top+.009,0),(.066,.007,.60))
 # dangling worn teddy, distinct attachment to left hand
 c.blob('bear','RHand',(.44,.65,.13),(.063,.095,.060));c.blob('bear','RHand',(.44,.756,.13),(.074,.070,.068))
 for a in [-1,1]:
    c.blob('bear','RHand',(.44+a*.066,.81,.13),(.035,.037,.032))
    c.blob('bear','RHand',(.44+a*.067,.61,.13),(.03,.055,.029))
 c.blob('dress','RHand',(.44,.748,.20),(.033,.028,.018))
 return c


def robot(name):
 shift=name=='Shift';c=Character(name,1);skeleton(c,False)
 c.surface('rubber','Pelvis',[(.30,.15,.13,0,0),(.41,.17,.145,0,0),(.49,.15,.14,0,0)],32)
 c.surface('steel' if shift else 'metal','Spine',[(.37,.17,.145,0,0),(.45,.20,.17,0,0),(.53,.20,.17,0,0),(.60,.14,.14,0,0)],48)
 # layered armor shells with genuine front/rear air gap, vent slits and screws
 c.plate('metal','Spine',(0,.48,.18),(.32,.27,.07),.018)
 c.plate('steel','Spine',(0,.49,.223),(.22,.195,.013),.008)
 c.plate('glass','Spine',(0,.486,.235),(.12,.098,.01),.004)
 for a in [-1,1]:
    side='L' if a<0 else 'R';up=side+'UpperArm';lo=side+'LowerArm';hand=side+'Hand';thigh=side+'UpperLeg';shin=side+'LowerLeg';foot=side+'Foot'
    c.blob('metal',up,(a*.205,.557,0),(.058,.058,.065))
    c.tube('rubber',up,[(a*.205,.55,0),(a*.225,.47,0),(a*.235,.385,-.01)],[.048,.044,.032])
    c.plate('steel',up,(a*.239,.457,.046),(.064,.132,.05),.01)
    c.blob('metal',lo,(a*.238,.371,0),(.041,.043,.044))
    c.tube('rubber',lo,[(a*.241,.373,0),(a*.258,.31,-.01),(a*.272,.235,-.02)],[.033,.032,.022])
    c.plate('steel',lo,(a*.268,.300,.035),(.055,.099,.06),.009)
    c.blob('metal',hand,(a*.274,.219,.008),(.05,.049,.048))
    for f in range(3):
        xx=a*.27+(f-1)*.032
        c.tube('rubber',hand,[(xx,.205,.015),(xx,.150,.048)], [.014,.010])
    c.blob('metal',thigh,(a*.137,.262,0),(.058,.062,.064))
    c.tube('rubber',thigh,[(a*.139,.26,0),(a*.15,.205,0),(a*.152,.16,0)],[.048,.042,.031])
    c.plate('steel',thigh,(a*.147,.220,.04),(.055,.080,.05),.009)
    c.blob('metal',shin,(a*.150,.159,0),(.039,.038,.038))
    c.tube('rubber',shin,[(a*.150,.152,0),(a*.15,.098,0),(a*.15,.065,.017)],[.032,.029,.022])
    c.blob('rubber',foot,(a*.15,.043,.085),(.078,.039,.132))
    c.plate('steel',foot,(a*.15,.060,.105),(.092,.019,.111),.009)
 # Neck struts, cable harness, real metal points and grooves
 for a in [-1,1]:
    c.tube('metal','Neck',[(a*.06,.56,0),(a*.055,.66,0)],[.035,.029])
    c.tube('rust','Neck',[(a*.103,.51,-.08),(a*.11,.555,-.11),(a*.08,.64,-.07)],[.007,.009,.006])
 if shift:
    # Actual hemispherical steel dome with cut edge, modeled as curved loft.
    dome=[]
    for j in range(29):
        a=PI*.5*j/28; dome.append((.705+.36*S(a),.47*C(a)+.003,.46*C(a)+.003,0,0))
    c.surface('metal','Head',dome,96,.004)
    c.surface('rubber','Head',[(.699,.483,.475,0,0),(.719,.483,.475,0,0)],72)
    c.plate('metal','Head',(0,.798,.403),(.77,.130,.105),.017)
    c.plate('glass','Head',(0,.794,.453),(.67,.086,.025),.011)
    for a in [-1,1]:
        c.plate('light','Head',(a*.225,.794,.470),(.215,.028,.012),.005)
        c.plate('metal','Head',(a*.225,.863,.430),(.22,.024,.024),.004)
    for i in range(14):
        a=i*2*PI/14
        c.blob('rust','Head',(.473*C(a),.710,.457*S(a)),(.016,.013,.016))
    # physical damage & repair seam down dome
    c.tube('rust','Head',[(0,.92,.35),(-.02,1.01,.25),(-.03,1.056,0)],[.006,.007,.004])
    # two barrel clusters on right side, plus magazine & sight
    c.plate('metal','Gun',(.48,.50,.18),(.39,.16,.16),.021)
    c.blob('steel','Gun',(.72,.50,.18),(.12,.105,.11))
    for i in range(6):
        a=2*PI*i/6
        y=.50+.055*C(a);z=.18+.055*S(a)
        c.tube('metal','Barrel',[(.69,y,z),(.88,y,z),(1.04,y,z)],[.017,.017,.014])
    c.blob('rust','Gun',(.72,.50,.18),(.014,.117,.117))
 else:
    # Heavy asymmetrical trapezoid housing: tapered shell, bevel edge, recessed lenses.
    def outer(y):
        t=(y-.674)/.58;return .32+.115*t
    for y0,y1 in [( .677,.69),(.69,1.18),(1.18,1.215)]:
        w0=outer(y0);w1=outer(y1)
        c.mesh('metal','Head').quad([(-w0,y0,.27),(w0,y0,.27),(w1,y1,.27),(-w1,y1,.27)])
        c.mesh('metal','Head').quad([(w0,y0,-.23),(-w0,y0,-.23),(-w1,y1,-.23),(w1,y1,-.23)])
        for a in [-1,1]:c.mesh('metal','Head').quad([(a*w0,y0,.27),(a*w0,y0,-.23),(a*w1,y1,-.23),(a*w1,y1,.27)])
    c.plate('steel','Head',(0,1.205,.015),(.85,.022,.52),.011)
    c.plate('rust','Head',(0,.680,.015),(.635,.018,.51),.007)
    # inset eyes: dark gaskets, glass lenses and pale irises, physically separate depths
    for a in [-1,1]:
        c.blob('rubber','Head',(a*.235,.905,.277),(.143,.162,.016))
        c.blob('glass','Head',(a*.235,.905,.289),(.116,.138,.015))
        c.blob('light','Head',(a*.235,.91,.307),(.077,.115,.014))
        c.blob('glass','Head',(a*.220,.895,.328),(.026,.070,.009))
        c.blob('light','Head',(a*.212,.984,.342),(.018,.019,.005))
        # machined end plate, seams and screw holes
        c.plate('rust','Head',(a*.372,1.048,.275),(.025,.18,.02),.004)
        for h in [.722,1.163]:c.blob('rust','Head',(a*outer(h)*.87,h,.290),(.013,.014,.008))
        for i in range(4):
            c.plate('glass','Head',(a*.39,.825+i*.053,.015),(.013,.025,.16),.002)
    for h in [.73,1.19]:c.plate('rust','Head',(0,h,.278),(.61,.009,.012),.002)
 return c

# GLB packer: compliant glTF 2.0 skin, JOINTS_0/WEIGHTS_0, UVs, embedded textures,
# inverse bind matrices, physically based materials, and explicit rigid/soft skinning.
class GLB:
 def __init__(self,c):
    self.c=c;self.j={'asset':{'version':'2.0','generator':'HPP sculpted character armature v1'},'scene':0,'scenes':[{'nodes':[]}], 'nodes':[], 'meshes':[], 'skins':[], 'accessors':[], 'bufferViews':[], 'buffers':[{'byteLength':0}], 'materials':[], 'textures':[], 'images':[], 'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]}
    self.data=bytearray()
 def append(self,data,target=None):
    offset=len(self.data);self.data.extend(data);self.data.extend(bytes((-len(self.data))%4))
    view={'buffer':0,'byteOffset':offset,'byteLength':len(data)}
    if target:view['target']=target
    i=len(self.j['bufferViews']);self.j['bufferViews'].append(view);return i
 def accessor(self,arr,type_,component,normalized=False,target=None):
    ar=np.asarray(arr);view=self.append(ar.tobytes(),target)
    item={'bufferView':view,'componentType':component,'count':len(ar),'type':type_}
    if normalized:item['normalized']=True
    if type_=='VEC3':item['min']=list(map(float,ar.min(axis=0)));item['max']=list(map(float,ar.max(axis=0)))
    self.j['accessors'].append(item);return len(self.j['accessors'])-1
 def setup_materials(self):
    for name,png in TEXTURES.items():
        v=self.append(png);self.j['images'].append({'bufferView':v,'mimeType':'image/png','name':name})
        idx=len(self.j['textures']);self.j['textures'].append({'sampler':0,'source':len(self.j['images'])-1})
        metal= .72 if name in ['steel','metal'] else .2 if name=='rust' else 0
        rough= .60 if name=='steel' else .81 if name=='metal' else .25 if name=='glass' else .94
        pbr={'baseColorTexture':{'index':idx},'metallicFactor':metal,'roughnessFactor':rough}
        self.j['materials'].append({'name':name,'pbrMetallicRoughness':pbr,'doubleSided':name in ['dress','dress_dark','card','face']})
 def normals(self,verts,indices):
    n=np.zeros_like(verts,dtype=np.float32)
    for i,j,k in indices:
        normal=np.cross(verts[j]-verts[i],verts[k]-verts[i]);n[i]+=normal;n[j]+=normal;n[k]+=normal
    size=np.linalg.norm(n,axis=1);n/=np.maximum(size[:,None],1e-10);n[size<1e-9]=[0,1,0];return n
 def build(self):
    c=self.c;self.setup_materials();world=[]
    for idx,(name,parent,t) in enumerate(c.bones):
        par=c.bone_lookup[parent] if parent is not None else None
        p=np.array(t,dtype=np.float32)+(world[par] if par is not None else 0)
        world.append(p)
        self.j['nodes'].append({'name':name,'translation':list(map(float,t)),'children':[]})
        if par is not None:self.j['nodes'][par]['children'].append(idx)
    self.j['scenes'][0]['nodes'].append(0)
    # Skin matrices: all joints are translations in bind pose; vertex coordinates are global.
    ibm=np.array([np.array([[1,0,0,-w[0]],[0,1,0,-w[1]],[0,0,1,-w[2]],[0,0,0,1]],dtype=np.float32).flatten(order='F') for w in world],dtype=np.float32)
    # Flatten a conventional row-major matrix into glTF's column-major serialization.
    bind=self.accessor(ibm,'MAT4',5126)
    self.j['skins'].append({'name':c.name+'Skeleton','joints':list(range(len(c.bones))),'skeleton':0,'inverseBindMatrices':bind})
    # Geometry batching: one draw call per material, retaining vertex-level bone indices.
    for material,part in [(mat,part) for mat in TEXTURES for part in (['body','gun'] if c.name=='Shift' else ['body'])]:
        members=[m for m in c.meshes if m.mat==material and m.faces and (('gun' if c.bones[m.bone][0] in ('Gun','Barrel') else 'body')==part)]
        if not members:continue
        positions=[];uvs=[];triangles=[];joint_data=[];weight_data=[];offset=0
        for m in members:
            v=np.asarray(m.v,dtype=np.float32)
            positions.append(v);uvs.append(np.asarray(m.uv,dtype=np.float32))
            triangles.append(np.asarray(m.faces,dtype=np.uint32)+offset)
            offset+=len(v)
            joints=np.zeros((len(v),4),dtype=np.uint16);weights=np.zeros((len(v),4),dtype=np.float32)
            joints[:,0]=m.bone;weights[:,0]=1
            bname=c.bones[m.bone][0]
            blend=None
            if c.name=='Tab' and m.mat in ('skin','dress'):
                if bname.endswith('UpperArm'):
                    blend=(bname.replace('UpperArm','LowerArm'), np.clip((1.13-v[:,1])/.115,0,1))
                elif bname.endswith('LowerArm'):
                    blend=(bname.replace('LowerArm','UpperArm'),np.clip((v[:,1]-1.01)/.12,0,1))
                elif bname=='Pelvis' and m.mat=='dress':
                    blend=('Spine',np.clip((v[:,1]-.95)/.22,0,.42))
            if blend is not None:
                secondary,amount=blend
                joints[:,1]=c.bone_lookup[secondary];weights[:,0]=1-amount;weights[:,1]=amount
            joint_data.append(joints);weight_data.append(weights)
        v=np.concatenate(positions);uv=np.concatenate(uvs);faces=np.vstack(triangles)
        normals=self.normals(v,faces)
        joints=np.concatenate(joint_data);weights=np.concatenate(weight_data)
        a={'POSITION':self.accessor(v,'VEC3',5126,target=34962),'NORMAL':self.accessor(normals,'VEC3',5126,target=34962), 'TEXCOORD_0':self.accessor(uv,'VEC2',5126,target=34962),'JOINTS_0':self.accessor(joints,'VEC4',5123,target=34962),'WEIGHTS_0':self.accessor(weights,'VEC4',5126,target=34962)}
        idx=self.accessor(faces.flatten(),'SCALAR',5125,target=34963)
        self.j['meshes'].append({'name':c.name+'_'+material+'_'+part,'primitives':[{'attributes':a,'indices':idx,'material':list(TEXTURES).index(material),'mode':4}]})
        node=len(self.j['nodes']);self.j['nodes'].append({'name':c.name+'_surface_'+material+'_'+part,'mesh':len(self.j['meshes'])-1,'skin':0})
        self.j['scenes'][0]['nodes'].append(node)
    self.j['buffers'][0]['byteLength']=len(self.data)
    jb=json.dumps(self.j,separators=(',',':')).encode();jb+=b' '*((-len(jb))%4)
    b=bytes(self.data)
    return struct.pack('<4sII',b'glTF',2,12+8+len(jb)+8+len(b))+struct.pack('<I4s',len(jb),b'JSON')+jb+struct.pack('<I4s',len(b),b'BIN\0')+b

def validate_glb(raw):
    magic,ver,length=struct.unpack('<4sII',raw[:12]); assert (magic,ver,length)==(b'glTF',2,len(raw));jlen,typ=struct.unpack('<I4s',raw[12:20]);assert typ==b'JSON';j=json.loads(raw[20:20+jlen]);assert len(j['skins'])==1 and len(j['skins'][0]['joints'])>=15
    assert len(j['meshes'])>=6 and len(j['textures'])>=6
    assert all('JOINTS_0' in mesh['primitives'][0]['attributes'] and 'TEXCOORD_0' in mesh['primitives'][0]['attributes'] for mesh in j['meshes']);return j

if __name__=='__main__':
 for c in [tab(),robot('Shift'),robot('Qwerty')]:
    raw=GLB(c).build();j=validate_glb(raw)
    dest=DEST/(c.name.lower()+'.glb');dest.write_bytes(raw)
    print(dest,'bytes',len(raw),'meshes',len(j['meshes']),'bones',len(j['skins'][0]['joints']), 'vertices',sum(len(m.v) for m in c.meshes))