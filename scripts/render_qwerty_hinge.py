#!/usr/bin/env python3
"""Reproducible offline GLB geometry render for Q1.3: closed, half-open, open.

Shows real indexed GLB triangles, rigidly skinning skull_upper and child eyes
and eyelids around the bound rear-edge hinge. This is not an in-browser render.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import vtk
from vtk.util.numpy_support import numpy_to_vtk, numpy_to_vtkIdTypeArray
from qwerty_head_hinge import unpack,read

COLORS=['#4b4a4c','#1a1a1d','#060607','#333337','#666668','#090a0c','#ffffff','#111111']

def render(path,output,angle,view):
    doc,binary=unpack(path)
    scene=vtk.vtkRenderer()
    scene.SetBackground(.89,.875,.855)
    pivot=np.array([0.,1.175,-.26])
    for prim in doc['meshes'][0]['primitives']:
        triangles=read(doc,binary,prim['indices']).astype(np.int64).ravel().reshape(-1,3)
        verts=read(doc,binary,prim['attributes']['POSITION']).astype(np.float64)
        bones=read(doc,binary,prim['attributes']['JOINTS_0'])[:,0]
        affected=np.isin(bones,[4,17,18])
        v=verts[affected]-pivot
        rotated=v.copy()
        rotated[:,1]=v[:,1]*np.cos(angle)-v[:,2]*np.sin(angle)
        rotated[:,2]=v[:,1]*np.sin(angle)+v[:,2]*np.cos(angle)
        verts[affected]=rotated+pivot
        points=vtk.vtkPoints()
        points.SetData(numpy_to_vtk(verts.astype(np.float32),deep=True))
        poly=vtk.vtkPolyData()
        poly.SetPoints(points)
        packed=np.column_stack([np.full(len(triangles),3,dtype=np.int64),triangles]).ravel()
        cells=vtk.vtkCellArray()
        cells.SetCells(len(triangles),numpy_to_vtkIdTypeArray(packed,deep=True))
        poly.SetPolys(cells)
        mapper=vtk.vtkPolyDataMapper()
        mapper.SetInputData(poly)
        actor=vtk.vtkActor()
        actor.SetMapper(mapper)
        color=COLORS[prim['material']]
        actor.GetProperty().SetColor(*(int(color[i:i+2],16)/255 for i in (1,3,5)))
        actor.GetProperty().SetAmbient(.94 if prim['material']!=1 else .84)
        actor.GetProperty().SetDiffuse(.06 if prim['material']!=1 else .16)
        if prim['material']==6:
            actor.GetProperty().SetAmbient(1)
            actor.GetProperty().SetDiffuse(0)
        scene.AddActor(actor)
    cam=scene.GetActiveCamera()
    cam.SetPosition(*({'threequarter':(-4.2,2.35,7.2),'side':(-7,1.7,0)}[view]))
    cam.SetFocalPoint(0,1.55,0)
    cam.SetViewUp(0,1,0)
    cam.ParallelProjectionOn()
    cam.SetParallelScale(1.8)
    window=vtk.vtkRenderWindow()
    window.SetOffScreenRendering(True)
    window.SetSize(650,600)
    window.AddRenderer(scene)
    window.Render()
    frame=vtk.vtkWindowToImageFilter()
    frame.SetInput(window)
    frame.Update()
    writer=vtk.vtkPNGWriter()
    writer.SetFileName(str(output))
    writer.SetInputConnection(frame.GetOutputPort())
    writer.Write()
    window.Finalize()

def run(source,destination):
    destination.mkdir(parents=True,exist_ok=True)
    poses=[('CLOSED',0.),('HALF-OPEN',-.35),('FULL-OPEN',-.8)]
    views=('threequarter','side')
    for view in views:
        for label,angle in poses:
            render(source,destination/f'{view}-{label.lower()}.png',angle,view)
    w,h=520,480
    montage=Image.new('RGB',(w*3,h*2+94),'#e3e0dc')
    draw=ImageDraw.Draw(montage)
    try:font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
    except OSError:font=ImageFont.load_default()
    for row,view in enumerate(views):
        for col,(label,_) in enumerate(poses):
            pane=Image.open(destination/f'{view}-{label.lower()}.png').convert('RGB').resize((w,h))
            montage.paste(pane,(col*w,row*h+35))
            draw.text((col*w+14,row*h+9),f'{view.upper()}  /  {label}',fill='#17171a',font=font)
    draw.text((20,h*2+73),'Q1.3: stationary lower plate; complete eye-bearing housing moves',fill='#17171a',font=font)
    montage.save(destination/'Q1.3_hinge_poses.png',optimize=True)
    print('Rendered',destination/'Q1.3_hinge_poses.png')

if __name__=='__main__':
    run(Path(sys.argv[1]),Path(sys.argv[2]))
