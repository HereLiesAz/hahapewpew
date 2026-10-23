#!/usr/bin/env python3
"""Q1.5: true-to-reference flat eyes and independently animated 2D eyelids."""
import argparse,json,struct
from pathlib import Path
RADIUS_RIGHT=.82
EYE_R_X=.45; EYE_CENTER_Y=1.87; LID_CENTER_Y=2.25
def read(path):
    b=bytearray(Path(path).read_bytes())
    assert b[:4]==b'glTF' and struct.unpack_from('<I',b,4)[0]==2
    jlen=struct.unpack_from('<I',b,12)[0];m=json.loads(b[20:20+jlen])
    start=20+jlen;blen,kind=struct.unpack_from('<I4s',b,start)
    assert kind==b'BIN\0'
    return m,bytearray(b[start+8:start+8+blen])
def build(source,dest):
    m,b=read(source);p=m['meshes'][0]['primitives']
    assert m['nodes'][18]['name']=='eyelidL' and m['nodes'][19]['name']=='eyelidR'
    assert m['materials'][p[6]['material']]['name']=='Qwerty/Eyes_2D_Emission'
    assert m['materials'][p[7]['material']]['name']=='Qwerty/Eyelid_2D'
    assert m['materials'][p[2]['material']]['name']=='Qwerty/Outline'
    e=m['materials'][p[6]['material']]
    assert e['emissiveFactor']==[1,1,1] and e['pbrMetallicRoughness']['baseColorFactor'][:3]==[1,1,1]
    counts={}
    for prim_id,kind in ((2,'outline'),(6,'eye'),(7,'lid')):
        acc=m['accessors'][p[prim_id]['attributes']['POSITION']]
        bv=m['bufferViews'][acc['bufferView']]
        off=bv.get('byteOffset',0)+acc.get('byteOffset',0)
        count=0
        for i in range(acc['count']):
            x,y,z=struct.unpack_from('<fff',b,off+12*i)
            eye=kind=='eye' and x>.1 and 1.5<y<2.23
            outline=kind=='outline' and x>.1 and .313<z<.318 and 1.48<y<2.23
            lid=kind=='lid' and x>.1 and 2.15<y<2.35
            if not (eye or outline or lid):continue
            yy=LID_CENTER_Y if lid else EYE_CENTER_Y
            x=EYE_R_X+(x-EYE_R_X)*RADIUS_RIGHT
            y=yy+(y-yy)*RADIUS_RIGHT
            struct.pack_into('<fff',b,off+12*i,x,y,z);count+=1
        counts[kind]=count
        if 'min' in acc and 'max' in acc:
            v=[struct.unpack_from('<fff',b,off+12*i) for i in range(acc['count'])]
            acc['min']=[min(x[j] for x in v) for j in range(3)]
            acc['max']=[max(x[j] for x in v) for j in range(3)]
    assert counts=={'outline':120,'eye':120,'lid':96},counts
    src=next(x for x in m['animations'] if x['name']=='Qwerty_Suspicious_Lids')
    for bone,name in ((18,'Qwerty_Left_Lid'),(19,'Qwerty_Right_Lid')):
        ch=next(x for x in src['channels'] if x['target']=={'node':bone,'path':'translation'})
        m['animations'].append({'name':name,'samplers':[src['samplers'][ch['sampler']].copy()],
                        'channels':[{'sampler':0,'target':{'node':bone,'path':'translation'}}]})
    m['asset']['extras']['qwertyEyesQ15']={'step':'Q1.5','source':'owner original artwork',
        'leftEyeRadius':.236,'rightEyeRadius':.19352,'eyeCenterY':1.87,'eyeSurfaceZ':.321,
        'rightEyeScale':.82,'blackOutlineScalesWithWhite':True,
        'eyeMaterials':'pure white emissive; gameplay red kill-mode override',
        'independentLids':['Qwerty_Left_Lid','Qwerty_Right_Lid'],
        'neutralLidsBehindFace':True,'squintLidsInFront':True,
        'unchanged':['face shape','stationary bottom plate','vertical head bounce','body','clamps','feet']}
    m['buffers'][0]['byteLength']=len(b)
    j=json.dumps(m,separators=(',',':'),ensure_ascii=True).encode();j+=b' '*((-len(j))%4)
    b+=b'\0'*((-len(b))%4)
    payload=b'glTF'+struct.pack('<II',2,12+8+len(j)+8+len(b))
    payload+=struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(b),b'BIN\0')+b
    dest=Path(dest);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(payload)
    print('Q1.5',counts,len(payload),'bytes')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('source',type=Path);p.add_argument('destination',type=Path);a=p.parse_args()
    build(a.source,a.destination)
