#!/usr/bin/env python3
"""Reference-bound skinned Tab GLB. No generative redesign: geometry follows tabshiftqwerty.jpg.
Dependencies: numpy, Pillow. Exports self-contained glTF 2.0 with explicit UVs, 19+ bone skin,
Tab_Idle/Tab_Walk/Tab_Bear_Swing clips, and painted box markings embedded in GLB.
"""
import argparse, io, json, math, struct, pathlib
import numpy as np
from PIL import Image, ImageDraw, ImageFont
S,C,PI=math.sin,math.cos,math.pi
BONES=[
 ('root',None,(0,0,0)),('spine','root',(0,1.30,0)),('chest','spine',(0,.36,0)),
 ('neck','chest',(0,.25,0)),('head','neck',(0,.07,0)),
 ('shoulder.L','chest',(-.22,.12,0)),('elbow.L','shoulder.L',(-.16,-.32,.02)),
 ('wrist.L','elbow.L',(.06,-.17,.06)),('hand.L','wrist.L',(.02,-.01,0)),
 ('shoulder.R','chest',(.23,.12,0)),('elbow.R','shoulder.R',(.10,-.43,.015)),
 ('wrist.R','elbow.R',(.015,-.28,.045)),('hand.R','wrist.R',(0,-.06,0)),
 ('bear','hand.R',(.06,-.12,.09)),
 ('hip.L','root',(-.125,.79,0)),('knee.L','hip.L',(-.015,-.42,.01)),
 ('ankle.L','knee.L',(.01,-.31,.025)),
 ('hip.R','root',(.125,.79,0)),('knee.R','hip.R',(.015,-.42,.015)),
 ('ankle.R','knee.R',(-.01,-.31,.025))
]
J={n:i for i,(n,_,_) in enumerate(BONES)}
REST={}
for n,p,rel in BONES:REST[n]=np.array(rel,float)+(REST[p] if p else 0)
P={
 'Ink':('#171513',0),'Cardboard':('#b58d63',0),'Cardboard_Light':('#d7aa73',0),
 'Box_Face':('#ffffff',0),'Box_Side':('#ffffff',0),'Tape':('#886c4e',0),
 'Dress_Dark':('#4a4443',0),'Dress_Main':('#756b68',0),'Dress_Light':('#a39891',0),
 'Dress_Shadow':('#373233',0),'Dress_Dirt':('#4a3c31',0),'Skin':('#e6a984',0),'Skin_Shadow':('#ad7256',0),
 'Shoe':('#29292b',0),'Bear':('#86572e',0),'Bear_Shadow':('#543119',0),
 'Bear_Muzzle':('#c39a63',0),'Bear_Black':('#141112',0)
}
def rgb(h):return [int(h[i:i+2],16)/255 for i in (1,3,5)]
class Builder:
 def __init__(self):self.parts={n:[] for n in P}
 def add(self,m,verts,faces,j,uv=None):
  v=np.asarray(verts,np.float32);f=np.asarray(faces,np.uint32).reshape(-1,3)
  if uv is None:
   low=v.min(axis=0);size=np.maximum(v.max(axis=0)-low,.001);uv=np.stack(((v[:,0]-low[0])/size[0],(v[:,1]-low[1])/size[1]),axis=1)
  self.parts[m].append((v,f,np.asarray(uv,np.float32),J[j]))
 def quad(self,m,v,j,uv=None):
  self.add(m,v,[(0,1,2),(0,2,3)],j,uv or [(0,0),(1,0),(1,1),(0,1)])
 def panel(self,m,verts,j,thickness=.008):
  # A closed thin slab, with its authored outer face left in place.
  v=np.asarray(verts,float);normal=np.cross(v[1]-v[0],v[2]-v[0]);normal/=np.linalg.norm(normal)
  self.add(m,np.concatenate((v,v-normal*thickness)),
   [(0,1,2),(0,2,3),(4,6,5),(4,7,6),(0,4,5),(0,5,1),
    (1,5,6),(1,6,2),(2,6,7),(2,7,3),(3,7,4),(3,4,0)],j)
 def prism(self,m,poly,front,back,j):
  n=len(poly);v=[[x,y,front] for x,y in poly]+[[x,y,back] for x,y in poly];f=[]
  for k in range(1,n-1):f.extend([(0,k,k+1),(n,n+k+1,n+k)])
  for k in range(n):a=k;b=(k+1)%n;f.extend([(a,b,n+b),(a,n+b,n+a)])
  self.add(m,v,f,j)
 def box(self,m,c,half,j):
  x,y,z=c;rx,ry,rz=half
  vs=[(x-rx,y-ry,z+rz),(x+rx,y-ry,z+rz),(x+rx,y+ry,z+rz),(x-rx,y+ry,z+rz),
      (x-rx,y-ry,z-rz),(x+rx,y-ry,z-rz),(x+rx,y+ry,z-rz),(x-rx,y+ry,z-rz)]
  fs=[(0,1,2),(0,2,3),(5,4,7),(5,7,6),(4,0,3),(4,3,7),(1,5,6),(1,6,2),(3,2,6),(3,6,7),(4,5,1),(4,1,0)]
  self.add(m,vs,fs,j)
 def rod(self,m,a,b,r,j,seg=12,r2=None):
  a=np.asarray(a,float);b=np.asarray(b,float);axis=(b-a)/np.linalg.norm(b-a)
  t=np.cross(axis,[0,0,1]);t=t/(np.linalg.norm(t)+1e-8);q=np.cross(axis,t)
  v=[];rr=[r,r if r2 is None else r2]
  for p,rad in zip((a,b),rr):
   for i in range(seg):v.append((p+rad*(t*C(i*2*PI/seg)+q*S(i*2*PI/seg))).tolist())
  f=[]
  for i in range(seg):k=(i+1)%seg;f.extend([(i,k,k+seg),(i,k+seg,i+seg)])
  self.add(m,v,f,j)
 def ellipsoid(self,m,c,r,j,seg=18,rings=10):
  cx,cy,cz=c;rx,ry,rz=r;v=[];f=[];uv=[]
  for row in range(rings+1):
   polar=PI*row/rings
   for k in range(seg+1):
    a=k*2*PI/seg
    v.append([cx+rx*S(polar)*C(a),cy+ry*C(polar),cz+rz*S(polar)*S(a)])
    uv.append([k/seg,row/rings])
  for row in range(rings):
   for k in range(seg):a=row*(seg+1)+k;b=a+seg+1;f.extend([(a,b,a+1),(a+1,b,b+1)])
  self.add(m,v,f,j,uv)
 def path(self,m,points,rad,j):
  for a,b in zip(points,points[1:]):self.rod(m,a,b,rad,j,8)

def make_surface_textures():
 # Paint face on cardboard entirely within frontal surface, matching asymmetric hand drawn expression.
 W=512; face=Image.new('RGBA',(W,W),(192,147,96,255));d=ImageDraw.Draw(face)
 ink=(34,28,23,255);width=10
 def line(points,thickness=width):d.line(points,fill=ink,width=thickness,joint='curve')
 line([(103,87),(210,119)],11);line([(295,111),(397,80)],11)
 d.ellipse((99,144,220,272),outline=ink,width=11)
 d.ellipse((286,166,386,274),outline=ink,width=11)
 d.ellipse((152,194,166,208),fill=ink);d.ellipse((327,209,340,222),fill=ink)
 d.rounded_rectangle((117,328,390,435),radius=43,outline=ink,width=10)
 for x in [169,226,285,336]:line([(x,332),(x,432)],6)
 line([(120,383),(388,383)],6)
 side=Image.new('RGBA',(512,512),(153,116,76,255));dr=ImageDraw.Draw(side)
 try:font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',64)
 except OSError:font=ImageFont.load_default()
 for y,word in [(212,'THIS'),(296,'END'),(380,'UP')]:
  bb=dr.textbbox((0,0),word,font=font);dr.text(((512-(bb[2]-bb[0]))/2,y),word,fill=(104,24,20,255),font=font)
 dr.polygon([(255,52),(100,151),(152,151),(152,200),(365,200),(365,151),(410,151)],fill=(105,20,18,255))
 # Its text reads upside-down on the drawing. Put the complete artwork upside down.
 side=side.rotate(180)
 res={}
 for n,im in [('Box_Face',face),('Box_Side',side)]:
  f=io.BytesIO();im.save(f,format='PNG',optimize=True);res[n]=f.getvalue()
 # Dirty cloth is UV-locked; deterministic grime avoids runtime noise.
 rng=np.random.default_rng(431)
 uneven=np.asarray(Image.fromarray(rng.integers(0,256,(48,48),dtype=np.uint8)).resize((W,W),Image.Resampling.BICUBIC),dtype=np.float32)
 for n in ('Dress_Main','Dress_Dark','Dress_Light'):
  base=np.array([int(P[n][0][i:i+2],16) for i in (1,3,5)],np.float32)
  grain=rng.normal(0,6.0,(W,W,1))
  wash=(uneven[...,None]-128)*.12
  grime=np.linspace(5,25,W,dtype=np.float32)[:,None,None]
  cloth=np.clip(base+grain+wash-grime,0,255).astype(np.uint8)
  im=Image.fromarray(cloth,'RGB').convert('RGBA')
  stains=Image.new('RGBA',(W,W));sd=ImageDraw.Draw(stains)
  for k in range(90):
   x=int(rng.integers(0,W));y=int(rng.integers(0,W))
   rx=int(rng.integers(5,29));ry=int(rng.integers(12,65))
   sd.ellipse((x-rx,y-ry,x+rx,y+ry),fill=(56,40,29,int(rng.integers(17,61))))
  for k in range(28):
   x=int(rng.integers(0,W));y=int(rng.integers(0,W))
   sd.line([(x,y),(x+int(rng.integers(-20,21)),y+int(rng.integers(18,60)))],
           fill=(40,34,30,int(rng.integers(35,75))),width=int(rng.integers(2,6)))
  im=Image.alpha_composite(im,stains)
  out=io.BytesIO();im.save(out,format='PNG',optimize=True);res[n]=out.getvalue()
 return res

def build():
 b=Builder();
 # Neck does not emerge from the cardboard: box rests on upper body.
 # Box is wider than shoulders, near-square viewed head-on, with thick defined edges.
 # Five thin walls leave the underside open around the child's shoulders.
 # Preserve the existing outside dimensions and printed surfaces.
 for c,h in [((0,2.216,.257),(.349,.318,.004)),
             ((0,2.216,-.257),(.349,.318,.004)),
             ((-.345,2.216,0),(.004,.318,.253)),
             ((.345,2.216,0),(.004,.318,.253)),
             ((0,2.530,0),(.349,.004,.253))]:
  b.box('Cardboard',c,h,'head')
 # Draw twelve thin ink contours on the box edges, never a black solid cube.
 for x in (-.350,.350):
  for z in (-.264,.264):b.rod('Ink',(x,1.895,z),(x,2.534,z),.007,'head',8)
 for y in (1.895,2.534):
  for z in (-.264,.264):b.rod('Ink',(-.350,y,z),(.350,y,z),.007,'head',8)
  for x in (-.350,.350):b.rod('Ink',(x,y,-.264),(x,y,.264),.007,'head',8)
 b.quad('Box_Face',[[-.347,1.905,.271],[.347,1.905,.271],[.347,2.527,.271],[-.347,2.527,.271]],'head',[(0,1),(1,1),(1,0),(0,0)])
 # Left wall label: mapped to surface, not a sideways billboard.
 b.quad('Box_Side',[[-.359,1.905,-.259],[-.359,1.905,.260],[-.359,2.527,.260],[-.359,2.527,-.259]],'head',[(0,1),(1,1),(1,0),(0,0)])
 # Add blank cardboard on other side and rear so the box is brown from all angles.
 b.quad('Cardboard',[[.355,1.907,.261],[.355,1.907,-.261],[.355,2.528,-.261],[.355,2.528,.261]],'head')
 # Folded cardboard flaps: large, independent thin prisms; their corners and silhouettes matter.
 b.add('Ink',[[-.351,1.912,.255],[.352,1.912,.255],[.393,1.821,.695],[-.342,1.818,.691],
              [-.350,1.924,.247],[.348,1.924,.247],[.386,1.834,.690],[-.337,1.830,.687]],
       [(0,1,2),(0,2,3),(4,6,5),(4,7,6),(0,4,5),(0,5,1),(1,5,6),(1,6,2),(2,6,7),(2,7,3),(3,7,4),(3,4,0)],'head')
 b.quad('Cardboard_Light',[[-.342,1.925,.260],[.342,1.925,.260],[.375,1.839,.687],[-.336,1.840,.687]],'head')
 # Left flap projects horizontally then droops at outer tip.
 flap=[[-.353,1.908,-.242],[-.625,1.820,-.220],[-.680,1.751,.112],[-.351,1.831,.250]]
 b.panel('Ink',flap,'head');b.quad('Cardboard_Light',[[x+.004,y+.012,z+.006]for x,y,z in flap],'head')
 # Rear opening flaps do not obscure the body from front.
 b.panel('Cardboard',[[-.34,1.907,-.25],[.34,1.907,-.25],[.34,1.857,-.46],[-.34,1.857,-.46]],'head')
 # Fourth flap opens to the right; it is not a sealed lower box face.
 b.panel('Cardboard',[[.349,1.908,.250],[.349,1.908,-.250],
                       [.570,1.800,-.230],[.600,1.770,.230]],'head')
 # Thin corrugated upper tape strip.
 b.box('Tape',(0,2.540,-.015),(.055,.005,.246),'head')
 # Dress: fitted dark bodice and asymmetrical draped full skirt, cut with broad fabric folds.
 # Loft dimensions are calibrated to the source: slim waist and long A-line skirt.
 v=[];f=[];uv=[];N=64;M=18
 for row in range(M+1):
  t=row/M;y=1.335+(1-t)*.510
  rx=.185+.058*(1-t);rz=.138+.022*(1-t)
  for i in range(N+1):
   a=i*2*PI/N;wrinkle=1+.022*math.sin(7*a+row*.1)
   v.append([rx*C(a)*wrinkle,y,rz*S(a)*wrinkle]);uv.append([i/N,row/M])
 for row in range(M):
  for i in range(N):a=row*(N+1)+i;z=a+N+1;f.extend([(a,z,a+1),(a+1,z,z+1)])
 b.add('Dress_Dark',v,f,'chest',uv)
 # Black vertical neckline-like short dashes beneath the box flaps.
 for x in [-.11,0,.11]:
  b.path('Dress_Shadow',[(x,1.92,.159),(x*1.05,1.865,.171),(x*1.1,1.821,.166)],.012,'chest')
 # This dress is soiled and torn, not intentionally high-low tailored:
 # irregular physical apertures and notched edges expose the shins below.
 def skirt_point(a,t,offset=1.):
  r=.185+.255*t**1.16
  pleat=1+.105*t**1.7*S(9*a+2*t)+.048*t*t*S(15*a-4*t)+.025*t*t*S(5*a+.45)
  drape=-.185*t*max(0,C(a))+.052*t*max(0,-C(a))+.032*t*S(3*a)
  nick=.052*t**16*max(0,S(19*a+.4))**6
  nick+=.093*t**17*math.exp(-((a-2.88)/.095)**2)
  nick+=.073*t**17*math.exp(-((a-1.10)/.12)**2)
  return [r*C(a)*pleat*offset,1.39-.78*t+drape*t**3+nick,
          r*.68*S(a)*pleat*offset]
 N=96;M=42;v=[];uv=[];f=[]
 for row in range(M+1):
  t=row/M
  for i in range(N+1):
   a=i*2*PI/N
   v.append(skirt_point(a,t));uv.append([i/N,row/M])
 for row in range(M):
  t=(row+.5)/M
  for i in range(N):
   a=(i+.5)*2*PI/N
   rip1=((a-2.84)/.19)**2+((t-.75)/.095)**2
   rip2=((a-1.08)/.14)**2+((t-.60)/.072)**2
   if rip1<1 or rip2<1:continue
   u=row*(N+1)+i;z=u+N+1
   f.extend([(u,z,u+1),(u+1,z,z+1)])
 b.add('Dress_Main',v,f,'spine',uv)
 # Topology of layered folds matches the same drape without bridging rips.
 def fold(a0,angularwidth,material):
  verts=[];tex=[];faces=[];R=42
  for row in range(R+1):
   t=row/R
   for k in range(3):
    a=a0+angularwidth*(k/2-.5)
    verts.append(skirt_point(a,t,1.006));tex.append([k/2,t])
  for row in range(R):
   for k in range(2):
    u=row*3+k;z=u+3
    faces.extend([(u,z,u+1),(u+1,z,z+1)])
  b.add(material,verts,faces,'spine',tex)
 for a,w,m in [(PI*.19,.33,'Dress_Light'),(PI*.53,.24,'Dress_Shadow'),
               (PI*.80,.24,'Dress_Light'),(PI*.99,.20,'Dress_Dark'),
               (PI*1.70,.26,'Dress_Shadow'),(PI*1.86,.29,'Dress_Light'),
               (PI*1.96,.18,'Dress_Dark')]:fold(a,w,m)
 # Threads follow, but do not fill, the torn geometry.
 for a in (.82,1.06,1.12,2.78,2.86,3.04,4.95):
  edge=np.array(skirt_point(a,1.,1.01))
  b.path('Dress_Dirt',[edge,edge+np.array((.007,-.022,.008)),
                       edge+np.array((-.005,-.047,.014))],.0035,'spine')
 for a,t in ((2.64,.73),(2.96,.78),(.93,.59),(1.22,.62)):
  edge=np.array(skirt_point(a,t,1.01))
  b.path('Dress_Dirt',[edge,edge+np.array((.013,-.015,.012))],.003,'spine')
 # Belt-like waist band curved around torso, not a hard squared box.
 for k in range(40):
  a=2*PI*k/40;n=2*PI*(k+1)/40
  b.quad('Dress_Shadow',[[.19*C(a),1.362,.14*S(a)],[.19*C(n),1.362,.14*S(n)],
                         [.19*C(n),1.328,.14*S(n)],[.19*C(a),1.328,.14*S(a)]],'spine')
 # Bare child shins and knees, thin and tapered with solid dark flat shoes.
 for side in [-1,1]:
  hip='hip.L' if side<0 else 'hip.R';knee='knee.L' if side<0 else 'knee.R';ankle='ankle.L' if side<0 else 'ankle.R'
  x=side*.135
  # Bare child legs retain the short proportion, but knees are anatomically
  # tapered rather than ball joints and rounded flats sit on the ground.
  b.ellipsoid('Skin',(x,.759,.010),(.090,.157,.090),hip)
  b.rod('Skin',(x,.712,.0),(x+side*.014,.371,.016),.074,hip,16,.067)
  b.ellipsoid('Skin',(x+side*.014,.357,.016),(.069,.076,.069),knee)
  b.ellipsoid('Skin',(x+side*.014,.366,.068),(.053,.045,.027),knee)
  b.rod('Skin',(x+side*.015,.353,.016),(x+side*.004,.145,.028),.071,knee,18,.047)
  b.ellipsoid('Skin',(x+side*.004,.147,.030),(.048,.068,.053),ankle)
  # Thin rounded ballet flats: a low vamp, dark toe and ground-level sole.
  b.ellipsoid('Shoe',(x,.051,.126),(.096,.051,.163),ankle,24)
  b.rod('Ink',(x-.070,.091,.105),(x+.070,.091,.105),.008,ankle,8)
 # Child shoulders remain narrow under short sleeves; rounded elbow transitions,
 # tapered forearms and separately sculpted thumbs keep each hand readable.
 b.ellipsoid('Skin',(-.240,1.758,0),(.065,.084,.067),'shoulder.L',18)
 b.rod('Dress_Dark',(-.223,1.777,0),(-.366,1.532,0),.109,'shoulder.L',16,.090)
 b.ellipsoid('Skin',(-.359,1.535,.005),(.073,.074,.072),'elbow.L',16)
 b.rod('Skin',(-.353,1.540,0),(-.510,1.354,.034),.072,'elbow.L',14,.056)
 b.rod('Skin',(-.505,1.351,.032),(-.205,1.287,.126),.055,'wrist.L',14,.038)
 # Four little fingers curve across her hip; thumb hooks over the waist.
 b.ellipsoid('Skin',(-.193,1.295,.135),(.065,.050,.043),'hand.L',16)
 for k in range(4):
  y=1.333-k*.029
  b.rod('Skin',(-.184,y,.169),(-.136,y-.014,.185),.012,'hand.L',9,.009)
 b.rod('Skin',(-.236,1.307,.157),(-.205,1.271,.196),.015,'hand.L',10,.010)
 b.ellipsoid('Skin',(.239,1.756,0),(.066,.083,.067),'shoulder.R',18)
 b.rod('Dress_Dark',(.223,1.776,0),(.292,1.571,.005),.098,'shoulder.R',16,.074)
 b.ellipsoid('Skin',(.293,1.559,.008),(.065,.074,.066),'elbow.R',16)
 b.rod('Skin',(.290,1.571,.008),(.333,1.243,.016),.063,'elbow.R',15,.045)
 b.rod('Skin',(.333,1.242,.016),(.363,1.030,.055),.049,'wrist.R',14,.034)
 b.ellipsoid('Skin',(.366,1.013,.059),(.053,.073,.041),'hand.R',14)
 for k in range(3):
  x=.344+k*.019;b.rod('Skin',(x,.957,.083),(x+.007,.924,.081),.010,'hand.R',8)
 b.rod('Skin',(.325,1.026,.068),(.329,.976,.122),.013,'hand.R',10,.010)
 # The left ear sits inside the right hand's grasp, not floating in front
 # of it. The remaining plush falls below the wrist independently of the dress.
 x,y,z=.465,.777,.109
 b.ellipsoid('Bear',(x,y-.07,z),(.111,.167,.075),'bear',20)
 b.ellipsoid('Bear',(x,y+.10,z),(.144,.124,.087),'bear',20)
 for side in [-1,1]:
  b.ellipsoid('Bear',(x+side*.117,y+.196,z),(.048,.056,.034),'bear',12)
  b.ellipsoid('Bear',(x+side*.124,y-.057,z),(.050,.105,.049),'bear',12)
  b.ellipsoid('Bear',(x+side*.072,y-.220+(side>0)*.018,z),(.045,.075,.045),'bear',12)
  # Flat ink eyes and tiny catchlights, not raised white beads.
  b.ellipsoid('Bear_Black',(x+side*.052,y+.128,z+.093),(.021,.021,.005),'bear',12)
  b.ellipsoid('Bear_Muzzle',(x+side*.057,y+.138,z+.098),(.004,.004,.002),'bear',8)
 b.ellipsoid('Bear_Muzzle',(x,y-.054,z+.069),(.078,.124,.016),'bear')
 b.ellipsoid('Bear_Muzzle',(x,y+.057,z+.087),(.067,.043,.014),'bear')
 b.ellipsoid('Bear_Black',(x,y+.066,z+.106),(.021,.015,.009),'bear',10)
 # Small stitched seams and sagging fabric reinforce a carried soft toy,
 # not a rigid plastic figure. The held ear remains attached to the bear bone.
 b.path('Bear_Shadow',[(x-.100,y+.040,z+.056),(x-.103,y-.045,z+.073),
                      (x-.075,y-.163,z+.055)],.006,'bear')
 b.path('Bear_Shadow',[(x-.144,y+.203,z-.010),(x-.137,y+.242,z+.008),
                      (x-.109,y+.239,z+.024)],.006,'bear')
 # Entire teddy slumps outward about the same ear held by the right hand.
 # Preserve bear-joint weights, local pivot and its existing swing clip.
 tilt=.35
 grip=np.array((.348,.973,.109),np.float32)
 for material in ('Bear','Bear_Shadow','Bear_Muzzle','Bear_Black'):
  for i,(verts,faces,tex,joint) in enumerate(b.parts[material]):
   v=verts.copy()
   dx=v[:,0]-grip[0];dy=v[:,1]-grip[1]
   v[:,0]=grip[0]+C(tilt)*dx-S(tilt)*dy
   v[:,1]=grip[1]+S(tilt)*dx+C(tilt)*dy
   b.parts[material][i]=(v,faces,tex,joint)
 return b

class Writer:
 def __init__(self):self.data=bytearray();self.views=[];self.acc=[]
 def view(self,blob,target=None):
  while len(self.data)%4:self.data.append(0)
  off=len(self.data);self.data.extend(bytes(blob));ent={'buffer':0,'byteOffset':off,'byteLength':len(blob)}
  if target:ent['target']=target
  self.views.append(ent);return len(self.views)-1
 def accessor(self,arr,ctype,atype,target=None,minmax=False):
  a=np.ascontiguousarray(arr);v=self.view(a.tobytes(),target);e={'bufferView':v,'componentType':ctype,'count':int(a.shape[0]),'type':atype}
  if minmax:e.update({'min':np.min(a,axis=0).astype(float).tolist(),'max':np.max(a,axis=0).astype(float).tolist()})
  self.acc.append(e);return len(self.acc)-1
 def export(self,path,b):
  prims=[]
  for material,blocks in b.parts.items():
   if not blocks:continue
   vlist=[];flist=[];uvlist=[];jlist=[];idx=0
   for verts,faces,uv,j in blocks:
    vlist.append(verts);uvlist.append(uv);flist.append(faces+idx);jlist.append(np.full(len(verts),j,np.uint16));idx+=len(verts)
   v=np.concatenate(vlist);uv=np.concatenate(uvlist);f=np.concatenate(flist).reshape(-1)
   e=v[f].reshape(-1,3);t=uv[f].reshape(-1,2);j=np.concatenate(jlist)[f]
   xyz=e.reshape(-1,3,3);cross=np.cross(xyz[:,1]-xyz[:,0],xyz[:,2]-xyz[:,0]);cross/=np.maximum(np.linalg.norm(cross,axis=1,keepdims=True),1.e-8)
   normals=np.repeat(cross,3,axis=0).astype(np.float32)
   # Smooth anatomical curves using shared source indices. Graphic box corners stay sharp.
   if material not in ('Ink','Cardboard','Cardboard_Light','Box_Face','Box_Side','Tape'):
    source_normals=np.zeros_like(v)
    np.add.at(source_normals,f.reshape(-1),normals)
    source_normals/=np.maximum(np.linalg.norm(source_normals,axis=1,keepdims=True),1.e-8)
    normals=source_normals[f].astype(np.float32)
   attrs={'POSITION':self.accessor(e.astype(np.float32),5126,'VEC3',34962,True),
     'NORMAL':self.accessor(normals,5126,'VEC3',34962),'TEXCOORD_0':self.accessor(t.astype(np.float32),5126,'VEC2',34962),
     'JOINTS_0':self.accessor(np.stack((j,np.zeros_like(j),np.zeros_like(j),np.zeros_like(j)),1),5123,'VEC4',34962),
     'WEIGHTS_0':self.accessor(np.tile(np.array([1,0,0,0],np.float32),(len(e),1)),5126,'VEC4',34962)}
   prims.append({'attributes':attrs,'material':list(P).index(material),'mode':4})
  nodes=[{'name':'Tab.mesh','mesh':0,'skin':0}]
  for name,parent,rel in BONES:
   ch=[i+1 for i,(n,p,_) in enumerate(BONES) if p==name]
   node={'name':name,'translation':list(rel)}
   if ch:node['children']=ch
   nodes.append(node)
  ibms=np.array([np.array([[1,0,0,-v[0]],[0,1,0,-v[1]],[0,0,1,-v[2]],[0,0,0,1]],np.float32).T.reshape(16) for n,_,_ in BONES for v in [REST[n]]],np.float32)
  skin={'joints':list(range(1,len(BONES)+1)),'skeleton':1,'inverseBindMatrices':self.accessor(ibms,5126,'MAT4')}
  def rx(deg):return [math.sin(deg/2),0,0,math.cos(deg/2)]
  def rz(deg):return [0,0,math.sin(deg/2),math.cos(deg/2)]
  def anim(name,channels):
   samplers=[];out=[]
   for name_node,path,times,values in channels:
    inp=self.accessor(np.array(times,np.float32),5126,'SCALAR');vals=np.array(values,np.float32)
    vtype='VEC4' if path=='rotation' else 'VEC3';ou=self.accessor(vals,5126,vtype)
    samplers.append({'input':inp,'output':ou,'interpolation':'LINEAR'});out.append({'sampler':len(samplers)-1,'target':{'node':J[name_node]+1,'path':path}})
   return {'name':name,'samplers':samplers,'channels':out}
  time=[0,.28,.56,.84,1.12]
  animations=[anim('Tab_Walk',[(bn,'rotation',time,[rx(a*mag) for a in [-1,0,1,0,-1]]) for bn,mag in [('hip.L',.25),('hip.R',-.25),('knee.L',.09),('knee.R',.09),('shoulder.R',-.13),('shoulder.L',.08)] ]),
              anim('Tab_Idle',[('spine','rotation',[0,1.5,3.0],[rz(0),rz(.018),rz(0)])]),
              anim('Tab_Bear_Swing',[('bear','rotation',[0,.33,.66,1.0,1.33],[rz(.10),rz(0),rz(-.10),rz(0),rz(.10)])])]
  textures={};imgs=[];texs=[]
  for name,content in make_surface_textures().items():
   bv=self.view(content);im={'bufferView':bv,'mimeType':'image/png','name':name};imgs.append(im)
   texs.append({'source':len(imgs)-1,'sampler':0,'name':name});textures[name]=len(texs)-1
  mats=[]
  for n,(color,emissive) in P.items():
   material={'name':'Tab/'+n,'pbrMetallicRoughness':{'baseColorFactor':rgb(color)+[1],'metallicFactor':0,'roughnessFactor':1},'doubleSided':True}
   if n in textures:
    material['pbrMetallicRoughness']['baseColorFactor']=[1,1,1,1]
    material['pbrMetallicRoughness']['baseColorTexture']={'index':textures[n]}
   mats.append(material)
  model={'asset':{'version':'2.0','generator':'HereLiesAz reference-bound Tab generator'},'scene':0,'scenes':[{'nodes':[0,1]}],
        'nodes':nodes,'meshes':[{'name':'Tab fully-skinned drawn-form','primitives':prims}],
        'skins':[skin],'materials':mats,'animations':animations,'images':imgs,'textures':texs,
        'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}],
        'buffers':[{'byteLength':0}],'bufferViews':self.views,'accessors':self.acc}
  while len(self.data)%4:self.data.append(0)
  model['buffers'][0]['byteLength']=len(self.data)
  js=json.dumps(model,separators=(',',':')).encode();js+=b' '*(-len(js)%4)
  size=12+8+len(js)+8+len(self.data)
  path=pathlib.Path(path);path.parent.mkdir(parents=True,exist_ok=True)
  path.write_bytes(struct.pack('<4sII',b'glTF',2,size)+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(self.data),b'BIN\x00')+self.data)
  return model
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--out',default='Tab_Reference.glb');a=parser.parse_args()
 m=Writer().export(a.out,build());print('exported',a.out,pathlib.Path(a.out).stat().st_size,'bytes',len(BONES),'bones',len(m['meshes'][0]['primitives']),'materials',len(m['animations']),'animations')
