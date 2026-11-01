// Dynamic gradient sky dome (sun, moon, stars, clouds), fog + light rig keyed by time of day and biome.
import * as THREE from 'three';
import { NIGHT_AT, biomeOf } from './data.js';
import { zoneAt } from './terrain.js';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const col = (h) => new THREE.Color(h);

const VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w; }`;
const FRAG = `
varying vec3 vDir;
uniform vec3 uHorizon, uZenith, uSunDir, uMoonDir, uSunCol, uCloudCol;
uniform float uNight, uTime, uSunVis, uCloudAmt;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vn(p); p*=2.03; a*=.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  float above = smoothstep(-0.03, 0.02, h);
  vec3 col = mix(uHorizon, uZenith, pow(clamp(h,0.,1.), .5));
  float sd = dot(d, uSunDir);
  col += uSunCol * (pow(max(sd,0.), 7.)*0.32 + pow(max(sd,0.), 60.)*0.55) * uSunVis;
  col = mix(col, uSunCol*1.5, smoothstep(0.9992, 0.9996, sd) * uSunVis * above);
  float md = dot(d, uMoonDir);
  vec3 mc = vec3(.93,.96,1.) * (0.82 + 0.18*vn(d.xz*45.+d.y*30.));
  col = mix(col, mc, smoothstep(0.9983, 0.9988, md) * above);
  col += vec3(.4,.55,.9) * pow(max(md,0.), 40.) * 0.28 * uNight;
  if (uNight > 0.01 && h > 0.0) {
    vec3 p = d*75.; vec3 c = floor(p);
    float r = fract(sin(dot(c, vec3(12.9898,78.233,37.719)))*43758.5453);
    float tw = .6+.4*sin(uTime*2.+r*50.);
    col += vec3(.9,.95,1.) * step(0.982, r) * smoothstep(.38,.0,length(fract(p)-.5)) * tw * uNight * smoothstep(0.,.15,h);
  }
  if (h > 0.015) {
    vec2 uv = d.xz / (h + .22) * 1.5 + uTime*.012;
    float n = fbm(uv);
    float cl = smoothstep(.5,.76,n) * smoothstep(.015,.2,h) * uCloudAmt;
    vec3 cc = mix(uCloudCol*.65, uCloudCol, smoothstep(.45,.85,n));
    col = mix(col, cc, cl*.88);
  }
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;

const MOTE_V = `
uniform float uTime, uSize, uFall; uniform vec3 uCam; uniform float uScale;
attribute vec3 aOff; varying float vA;
void main(){
  vec3 box = vec3(46., 16., 46.);
  vec3 p = aOff*box + vec3(uTime*0.35, -uTime*uFall*0.6, uTime*0.2) + vec3(sin(uTime*.7+aOff.x*20.)*1.2, sin(uTime*.9+aOff.z*20.)*.6, cos(uTime*.5+aOff.y*20.)*1.2);
  p = mod(p - uCam + box*.5, box) - box*.5;
  vec3 wp = uCam + p + vec3(0.,2.,0.);
  vec4 mv = viewMatrix * vec4(wp, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(26., uSize * 3.0 * (uScale / 520.) * clamp(10. / max(2., -mv.z), 0.6, 3.0));
  vA = (0.55 + 0.45*sin(uTime*1.6 + aOff.x*40.)) * smoothstep(23., 9., length(p));
}`;
const MOTE_F = `uniform vec3 uCol; uniform float uAlpha; varying float vA;
void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,.05,d) * vA * uAlpha; gl_FragColor = vec4(uCol*a, a); }`;

export class Sky {
  constructor(scene, quality) {
    this.scene = scene;
    this.U = {
      uHorizon: { value: col(0xbfe0e8) }, uZenith: { value: col(0x4a86c8) }, uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uMoonDir: { value: new THREE.Vector3(-1, -0.3, 0) },
      uSunCol: { value: col(0xfff0d0) }, uCloudCol: { value: col(0xffffff) }, uNight: { value: 0 }, uTime: { value: 0 }, uSunVis: { value: 1 }, uCloudAmt: { value: 0.8 },
    };
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 14), new THREE.ShaderMaterial({ uniforms: this.U, vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, fog: false }));
    this.dome.frustumCulled = false; this.dome.renderOrder = -10;
    scene.add(this.dome);
    scene.fog = new THREE.Fog(0xbfe0e8, 20, 90);
    this.hemi = new THREE.HemisphereLight(0xbfe0ff, 0x4a6a3a, 0.9);
    this.sun = new THREE.DirectionalLight(0xfff0d0, 1.6);
    this.sun.castShadow = quality.shadows;
    const sc = this.sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 160;
    this.sun.shadow.mapSize.set(1024, 1024); this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.08;
    scene.add(this.hemi, this.sun, this.sun.target);
    // ambient motes (dust / fireflies / snow / leaves / spores)
    const N = 160, off = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) off[i] = Math.random();
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    mg.setAttribute('aOff', new THREE.BufferAttribute(off, 3));
    this.MU = { uTime: { value: 0 }, uSize: { value: 3 }, uFall: { value: 0 }, uCam: { value: new THREE.Vector3() }, uScale: { value: 400 }, uCol: { value: col(0xfff2b0) }, uAlpha: { value: 0.6 } };
    this.motes = new THREE.Points(mg, new THREE.ShaderMaterial({ uniforms: this.MU, vertexShader: MOTE_V, fragmentShader: MOTE_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.motes.frustumCulled = false;
    scene.add(this.motes);
    this.tmp = { h: col(0), z: col(0), a: col(0), b: col(0) };
    this.info = { night: 0, sunH: 1, golden: 0, nightW: 0 };
  }
  setQuality(q) { this.sun.castShadow = q.shadows; }

  // tod 0..1 (0 sunrise, NIGHT_AT sunset), z = caravan z (biome blend), t = seconds
  update(tod, z, t, cam, focus, vh) {
    const zn = zoneAt(z);
    const A = biomeOf(zn.a), B = biomeOf(zn.b), w = zn.t;
    const p = tod < NIGHT_AT ? tod / NIGHT_AT : 1;
    const ang = p * Math.PI;
    const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang) * 0.85, 0.35).normalize();
    if (tod >= NIGHT_AT) sunDir.set(Math.cos(Math.PI + 0.2), -0.35, 0.35).normalize();
    const q = tod >= NIGHT_AT ? (tod - NIGHT_AT) / (1 - NIGHT_AT) : 1;
    const mAng = q * Math.PI;
    const moonDir = tod >= NIGHT_AT ? new THREE.Vector3(Math.cos(mAng), Math.sin(mAng) * 0.8 + 0.02, -0.3).normalize() : new THREE.Vector3(-1, -0.4, -0.3).normalize();
    const h = tod >= NIGHT_AT ? -0.3 : sunDir.y;
    const dayW = sstep(0.22, 0.6, h);
    const sm = sstep(-0.16, 0.06, h);
    const goldW = (1 - dayW) * sm, nightW = (1 - dayW) * (1 - sm);
    const mix2 = (key, i) => this.tmp.a.set(A[key][i]).lerp(this.tmp.b.set(B[key][i]), w).clone();
    const hor = mix2('day', 0).multiplyScalar(dayW).add(mix2('gold', 0).multiplyScalar(goldW)).add(mix2('night', 0).multiplyScalar(nightW));
    const zen = mix2('day', 1).multiplyScalar(dayW).add(mix2('gold', 1).multiplyScalar(goldW)).add(mix2('night', 1).multiplyScalar(nightW));
    const U = this.U;
    U.uHorizon.value.copy(hor); U.uZenith.value.copy(zen);
    U.uSunDir.value.copy(sunDir); U.uMoonDir.value.copy(moonDir);
    const sunCol = col(0xfff1d6).lerp(col(0xff9048), 1 - sstep(0.05, 0.45, h));
    U.uSunCol.value.copy(sunCol);
    U.uNight.value = nightW > 0.2 ? Math.min(1, (nightW - 0.2) / 0.5) : 0;
    U.uSunVis.value = sstep(-0.12, 0.05, h);
    U.uTime.value = t;
    const cc = this.tmp.a.set(A.cloud).lerp(this.tmp.b.set(B.cloud), w).clone();
    U.uCloudCol.value.copy(cc.multiplyScalar(dayW).add(col(0xff9a7a).multiplyScalar(goldW * 0.9)).add(col(0x2a3a5a).multiplyScalar(nightW * 1.0)));
    U.uCloudAmt.value = 0.9 - nightW * 0.35;
    this.dome.position.copy(cam.position);
    // fog matches the horizon colour
    const fog = this.scene.fog;
    fog.color.copy(hor);
    const nearA = A.fogNear + (B.fogNear - A.fogNear) * w, farA = A.fogFar + (B.fogFar - A.fogFar) * w;
    fog.near = nearA * (1 - 0.35 * nightW); fog.far = farA * (1 - 0.2 * nightW);
    // lights
    const useSun = tod < NIGHT_AT && h > -0.02;
    const dir = useSun ? sunDir : moonDir;
    const ws = sstep(-0.02, 0.14, h);
    const moonI = tod >= NIGHT_AT ? 0.5 * sstep(-0.02, 0.15, moonDir.y) : 0;
    this.sun.color.copy(useSun ? sunCol : col(0x8fb4ff));
    this.sun.intensity = useSun ? 0.15 + 1.65 * ws : moonI;
    this.sun.position.copy(focus).addScaledVector(dir, 70);
    this.sun.target.position.copy(focus);
    this.hemi.color.copy(hor).lerp(zen, 0.5).lerp(col(0xffffff), 0.15 * dayW);
    this.hemi.groundColor.set(A.ground[0]).lerp(this.tmp.b.set(B.ground[0]), w).multiplyScalar(0.8 * dayW + 0.6 * goldW + 0.4 * nightW);
    this.hemi.intensity = 0.4 + 0.75 * dayW + 1.0 * goldW + 0.85 * nightW;
    // motes
    const mo = A.mote, mb = B.mote, m = w < 0.5 ? mo : mb;
    const MU = this.MU;
    MU.uTime.value = t; MU.uCam.value.copy(cam.position); MU.uSize.value = m.size; MU.uFall.value = m.fall;
    MU.uScale.value = (vh || 400) * 0.9;
    MU.uCol.value.set(m.col);
    MU.uAlpha.value = m.fall > 0.5 ? 0.9 : (0.25 + 0.7 * (1 - dayW * 0.6));
    this.info = { night: nightW, sunH: h, golden: goldW, nightW, dayW };
    return this.info;
  }
}
