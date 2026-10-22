import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {celShadeRobot} from '../public/cel-robots.js';
test('Shift geometry is cel-shaded but 2D lit eyes stay flat',()=>{
 const root=new THREE.Group();
 root.add(new THREE.Mesh(new THREE.SphereGeometry(),new THREE.MeshPhysicalMaterial({name:'nickel',color:'#fff'})));
 root.add(new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshPhysicalMaterial({color:'#fff',emissive:'#fff',emissiveIntensity:.62})));
 const {eyes}=celShadeRobot(root,'Shift');
 assert.equal(root.children[0].material.type,'MeshToonMaterial');
 assert.equal(root.children[1].material.type,'MeshBasicMaterial');
 assert.equal(eyes.length,1);
 assert.equal(root.children[0].material.gradientMap.magFilter,THREE.NearestFilter);
 assert.equal(eyes[0].toneMapped,false);
});
test('Qwerty eyes stay solid white until kill mode',()=>{
 const root=new THREE.Group();
 root.add(new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshStandardMaterial({name:'Qwerty/Face_Matte'})));
 root.add(new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshStandardMaterial({name:'Qwerty/Eyes_2D_Emission'})));
 const {eyes}=celShadeRobot(root,'Qwerty');
 assert.equal(root.children[0].material.type,'MeshToonMaterial');
 assert.equal(eyes.length,1);eyes[0].color.set('#ff1616');
 assert.equal(eyes[0].color.getHexString(),'ff1616');
});
