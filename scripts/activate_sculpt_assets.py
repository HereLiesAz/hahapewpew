#!/usr/bin/env python3
"""Idempotently load standalone character assets, preserving the old model fallback."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
world=root/'public/world3d.js'
s=world.read_text()
old="import { createCharacters, articulateWalk } from './character-models.js';"
new=old+"\nimport { loadSculptedCharacters } from './sculpt-loader.js';"
if old not in s:raise SystemExit('Character import changed; refusing patch')
if new not in s:s=s.replace(old,new,1)
old='Object.assign(crew,createCharacters(scene));'
new=old+"\nloadSculptedCharacters(crew).catch(error => console.warn('GLB character assets unavailable; keeping previous models',error));"
if old not in s:raise SystemExit('Character boot changed; refusing patch')
if new not in s:s=s.replace(old,new,1)
world.write_text(s)
package=root/'package.json';p=package.read_text()
old='node --check public/character-models.js';new=old+' && node --check public/sculpt-loader.js'
if old not in p:raise SystemExit('npm check changed; refusing patch')
if new not in p:p=p.replace(old,new,1)
package.write_text(p)
