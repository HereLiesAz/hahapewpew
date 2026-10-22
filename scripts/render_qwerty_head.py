#!/usr/bin/env python3
"""Offline orthographic head turntable; renders the final glTF triangle data."""
import json,struct,math,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
import vtk
from vtk.util.numpy_support import numpy_to_vtk,numpy_to_vtkIdTypeArray
sys.path.insert(0,str(Path(__file__).resolve().parent))
from qwerty_head_geometry import unpack,COMPONENTS,SIZE

PALETTE=['#4c4b4d','#202023','#080809','#333337','#68686d','#0b0c0e','#ffffff','#101011']
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/evidence'
OUT.mkdir(parents=True,exist_ok=True)

def render(glb,path,view='front'):
 m,b=unpack(glb)
 def array(ai):
  a=m['accessors'][ai];v=m['bufferViews'][a['bufferView']]
  dt=COMPONENTS[a['componentType']][0]
  offset=v.get('byteOffset',0)+a.get('byteOffset',0)
  return np.frombuffer(b,dtype=dt,count=a['count']*SIZE[a['type']],offset=offset).reshape(-1,SIZE[a['type']])
 ren=vtk.vtkRenderer();ren.SetBackground(.925,.915,.89)
 for p in m['meshes'][0]['primitives']:
  mid=p['material'];pts=array(p['attributes']['POSITION']).astype(np.float32)
  faces=array(p['indices']).astype(np.int64).reshape(-1,3)
  points=vtk.vtkPoints();points.SetData(numpy_to_vtk(pts,deep=True))
  poly=vtk.vtkPolyData();poly.SetPoints(points)
  ids=np.concatenate([np.full((len(faces),1),3,dtype=np.int64),faces],axis=1).ravel()
  cells=vtk.vtkCellArray();cells.SetCells(len(faces),numpy_to_vtkIdTypeArray(ids,deep=True));poly.SetPolys(cells)
  mapr=vtk.vtkPolyDataMapper();mapr.SetInputData(poly)
  actor=vtk.vtkActor();actor.SetMapper(mapr)
  color=PALETTE[mid];actor.GetProperty().SetColor(*[int(color[i:i+2],16)/255 for i in (1,3,5)])
  actor.GetProperty().SetAmbient(1 if mid==6 else .8)
  actor.GetProperty().SetDiffuse(0 if mid==6 else .2)
  actor.GetProperty().SetSpecular(0)
  ren.AddActor(actor)
 cam=ren.GetActiveCamera()
 positions={
  'front':(0,1.65,7),'side':(-7,1.65,0),'threequarter':(-4,2.1,7.5)
 }
 cam.SetPosition(*positions[view]);cam.SetFocalPoint(0,1.45,0);cam.SetViewUp(0,1,0)
 cam.ParallelProjectionOn();cam.SetParallelScale(1.83 if view!='side' else 1.75)
 win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.SetSize(680,680);win.AddRenderer(ren)
 win.Render();f=vtk.vtkWindowToImageFilter();f.SetInput(win);f.Update();w=vtk.vtkPNGWriter();w.SetFileName(str(path));w.SetInputConnection(f.GetOutputPort());w.Write();win.Finalize()

for view in ('front','threequarter','side'):
 render(ROOT/'workbench/qwerty/Qwerty_Q12.glb',OUT/(view+'.png'),view)
render(ROOT/'public/assets/characters/Qwerty_Rigged.glb',OUT/'prior_front.png','front')
labels=[('prior_front.png','PREVIOUS · TALL HEAD'),('front.png','Q1.2 · FRONT'),('threequarter.png','Q1.2 · THREE-QUARTER'),('side.png','Q1.2 · PROFILE')]
w,h=480,540
sheet=Image.new('RGB',(w*4,h+60),'#eae7e1')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
for i,(fname,label) in enumerate(labels):
 im=Image.open(OUT/fname).convert('RGB').resize((w,h))
 sheet.paste(im,(i*w,0));ImageDraw.Draw(sheet).text((i*w+18,h+15),label,fill='#242528',font=font)
sheet.save(OUT/'qwerty-q12-silhouettes.png',optimize=True)
print('Rendered four views',sheet.size)
