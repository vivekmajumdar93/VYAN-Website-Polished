import * as THREE from 'three';
import gsap from 'gsap';
import { OrbDustTrail } from './OrbDustTrail';
import { SpringV3 } from '../app/Spring';

export type NanoOrbData = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  colorA: string;
  colorB: string;
};

function rand(min: number, max: number) {
    return min + Math.random() * (max - min);
}

function makeColor(t: number, fallbackA: string, fallbackB: string) {
    const blue = new THREE.Color(fallbackA || "#0014ff");
    const violet = new THREE.Color(fallbackB || "#5600ff");
    return blue.lerp(violet, t);
}

export class NanoOrb {
  public group = new THREE.Group();
  public trailGroup = new THREE.Group();
  public hitMesh: THREE.Mesh;
  public data: NanoOrbData;

  private home = new THREE.Vector3();
  private scale = 1;
  private visibleState = false;
  private seed: number;

  // Cinematic arrival — orb starts offset from home and springs in non-linearly.
  private arrival = new THREE.Vector3();        // current live offset (decays to 0)
  private arrivalSpring = new SpringV3();
  private arrivalActive = false;
  private lastT = -1;

  private trail: OrbDustTrail;

  private NODE_COUNT = 420;
  private nodeGeo = new THREE.BufferGeometry();
  private nodeBase: {x: number, y: number, z: number, phase: number}[] = [];
  private web: THREE.LineSegments;
  private nodeMat: THREE.PointsMaterial;
  private coreDust: THREE.Points;
  private haze: THREE.Points;
  private dust: THREE.Points;
  private satellites: THREE.Group;
  private socketGroup!: THREE.Group;
  private signalGroup!: THREE.Group;

  constructor(data: NanoOrbData, radius: number = 1.65, _networkSize: number = 4200) {
    this.data = data;
    this.seed = Math.random() * 1000;

    const nodePos = [];
    const nodeCols = [];
    const nodes = [];
    // PHASE 1-2: expansion state. Mutated by setExpansionProgress / setSignal.
    // Drives in-place unfolding: scale, brightness, web density, signal flow.
    (this as any).expansionT = 0;     // 0=dormant, 1=fully unfolded
    (this as any).visualDim = 1;      // 1=normal, <1=dim (when sibling orb is expanded)
    (this as any).signal = 'idle';
    (this as any).spectrumLo = new THREE.Color(this.data.colorA);
    (this as any).spectrumHi = new THREE.Color(this.data.colorB);

    for (let i = 0; i < this.NODE_COUNT; i++) {
        const r = Math.pow(Math.random(), 0.68) * 5.2;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        nodePos.push(x, y, z);
        this.nodeBase.push({ x, y, z, phase: Math.random() * 10 });
        nodes.push(new THREE.Vector3(x, y, z));

        const c = makeColor(Math.random(), this.data.colorA, this.data.colorB);
        nodeCols.push(c.r, c.g, c.b);
    }

    this.nodeGeo.setAttribute("position", new THREE.Float32BufferAttribute(nodePos, 3));
    this.nodeGeo.setAttribute("color", new THREE.Float32BufferAttribute(nodeCols, 3));

    this.nodeMat = new THREE.PointsMaterial({
        size: 0.055,
        transparent: true,
        opacity: 0.92,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const nodePoints = new THREE.Points(this.nodeGeo, this.nodeMat);
    this.group.add(nodePoints);

    // CONNECTION NETWORK
    const linePoints = [];
    for (let i = 0; i < this.NODE_COUNT; i++) {
        for (let j = i + 1; j < this.NODE_COUNT; j++) {
            const d = nodes[i].distanceTo(nodes[j]);
            if (d < 1.7 && Math.random() < 0.13) {
                linePoints.push(nodes[i].clone(), nodes[j].clone());
            }
        }
    }

    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lineMat = new THREE.LineBasicMaterial({
        color: this.data.colorB || "#ff1010",
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending
    });
    this.web = new THREE.LineSegments(lineGeo, lineMat);
    this.group.add(this.web);

    // QUANTUM STARDUST CORE
    const coreDustCount = 2800;
    const coreDustGeo = new THREE.BufferGeometry();
    const coreDustPos = [];
    const coreDustCol = [];

    const red = new THREE.Color(this.data.colorB || "#ff1010");
    const blue = new THREE.Color(this.data.colorA || "#001aff");
    const violet = new THREE.Color("#5200ff");

    for (let i = 0; i < coreDustCount; i++) {
        const r = Math.pow(Math.random(), 2.5) * 1.25;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        coreDustPos.push(x, y, z);

        let c;
        const mix = Math.random();
        if (mix < 0.33) {
            c = red.clone().lerp(violet, Math.random());
        } else if (mix < 0.66) {
            c = blue.clone().lerp(violet, Math.random());
        } else {
            c = red.clone().lerp(blue, Math.random());
        }
        coreDustCol.push(c.r, c.g, c.b);
    }

    coreDustGeo.setAttribute("position", new THREE.Float32BufferAttribute(coreDustPos, 3));
    coreDustGeo.setAttribute("color", new THREE.Float32BufferAttribute(coreDustCol, 3));

    this.coreDust = new THREE.Points(
        coreDustGeo,
        new THREE.PointsMaterial({
            size: 0.03,
            vertexColors: true,
            transparent: true,
            opacity: 0.92,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })
    );
    this.group.add(this.coreDust);

    // INNER HAZE
    const hazeGeo = new THREE.BufferGeometry();
    const hazePos = [];

    for (let i = 0; i < 1800; i++) {
        const r = Math.pow(Math.random(), 1.9) * 1.9;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);

        hazePos.push(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );
    }

    hazeGeo.setAttribute("position", new THREE.Float32BufferAttribute(hazePos, 3));

    this.haze = new THREE.Points(
        hazeGeo,
        new THREE.PointsMaterial({
            color: this.data.colorB || "#5d00ff",
            size: 0.012,
            transparent: true,
            opacity: 0.12,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    this.group.add(this.haze);

    // FLOATING SATELLITES
    this.satellites = new THREE.Group();
    this.group.add(this.satellites);

    for (let s = 0; s < 10; s++) {
        const cluster = new THREE.Group();
        cluster.position.set(rand(-7, 7), rand(-5, 5), rand(-4, 4));

        const pts = [];
        for (let i = 0; i < 8; i++) {
            pts.push(new THREE.Vector3(rand(-0.8, 0.8), rand(-0.8, 0.8), rand(-0.8, 0.8)));
        }

        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const dots = new THREE.Points(
            geo,
            new THREE.PointsMaterial({
                color: this.data.colorB || "#ff1111",
                size: 0.045,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        cluster.add(dots);

        const pair = [];
        for (let a = 0; a < pts.length; a++) {
            for (let b = a + 1; b < pts.length; b++) {
                if (pts[a].distanceTo(pts[b]) < 1.15) {
                    pair.push(pts[a].clone(), pts[b].clone());
                }
            }
        }

        const lgeo = new THREE.BufferGeometry().setFromPoints(pair);
        const lmat = new THREE.LineBasicMaterial({
            color: this.data.colorA || "#ff0000",
            transparent: true,
            opacity: 0.28
        });
        cluster.add(new THREE.LineSegments(lgeo, lmat));

        cluster.userData.speed = rand(0.1, 0.4);
        this.satellites.add(cluster);
    }

    // STARDUST CLOUD
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = [];
    const dustCol = [];

    for (let i = 0; i < 2200; i++) {
        const r = rand(4.5, 12);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);

        dustPos.push(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );

        const c = Math.random() < 0.4
            ? new THREE.Color(this.data.colorA || "#ff1010")
            : Math.random() < 0.5
            ? new THREE.Color(this.data.colorB || "#0014ff")
            : new THREE.Color("#5600ff");

        dustCol.push(c.r, c.g, c.b);
    }

    dustGeo.setAttribute("position", new THREE.Float32BufferAttribute(dustPos, 3));
    dustGeo.setAttribute("color", new THREE.Float32BufferAttribute(dustCol, 3));

    this.dust = new THREE.Points(
        dustGeo,
        new THREE.PointsMaterial({
            size: 0.018,
            transparent: true,
            opacity: 0.22,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    this.group.add(this.dust);

    // Hit Mesh
    this.hitMesh = new THREE.Mesh(
      new THREE.SphereGeometry(6.5, 16, 16),
      new THREE.MeshBasicMaterial({ visible: false, depthWrite: false })
    );
    this.group.add(this.hitMesh);

    // PHASE 3 v2 — clickable PRODUCT NODES (only enabled for Vistāra orb).
    // Tiny additive dots placed at scattered "intersection-like" positions
    // around the orb's plexus. Each carries a productKey for raycast click
    // routing. They're invisible until expansionT > 0.1, then bloom in.
    // Set via `enableProductSockets(keys)` from ShunyaRealm.
    this.socketGroup = new THREE.Group();
    this.socketGroup.visible = false;
    this.group.add(this.socketGroup);

    // PHASE 3 v2 — ELECTRIC SIGNAL PULSES. Travel from random branch
    // origins toward each socket so the user can SEE which dots to click.
    this.signalGroup = new THREE.Group();
    this.signalGroup.visible = false;
    this.group.add(this.signalGroup);

    this.trail = new OrbDustTrail('#a066ff');
    this.trailGroup.add(this.trail.group);

    this.group.visible = false;
    this.trailGroup.visible = false;
  }

  /**
   * Enable clickable product sockets on this orb. Tiny dots at scattered
   * intersection-like positions, each tagged with its productKey for
   * raycast click → URL routing.
   * Only Vistāra calls this.
   */
  enableProductSockets(productKeys: string[]) {
    // Clear any existing sockets.
    while (this.socketGroup.children.length) {
      const c = this.socketGroup.children[0];
      this.socketGroup.remove(c);
      (c as any).geometry?.dispose?.();
      (c as any).material?.dispose?.();
    }
    while (this.signalGroup.children.length) {
      const c = this.signalGroup.children[0];
      this.signalGroup.remove(c);
      (c as any).geometry?.dispose?.();
      (c as any).material?.dispose?.();
    }

    const socketColor = new THREE.Color(this.data.colorB || '#ff5a7a');
    // Use a seeded RNG so positions are stable across mounts.
    let seed = 1337;
    const srand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let i = 0; i < productKeys.length; i++) {
      const key = productKeys[i];

      // Place the dot at a scattered intersection-like point: random angle,
      // radius near orb edge (1.7..2.4) with depth jitter. This puts the
      // dot AMONG the web's outer intersections, not on a giant ring.
      const angle = srand() * Math.PI * 2;
      const elev  = (srand() - 0.5) * 1.1;
      const r     = 1.7 + srand() * 0.7;
      const lp = new THREE.Vector3(
        Math.cos(angle) * Math.cos(elev) * r,
        Math.sin(elev) * r,
        Math.sin(angle) * Math.cos(elev) * r,
      );

      // The dot itself — a small additive billboard sprite for max
      // visibility without the giant disc look.
      const dotGeom = new THREE.SphereGeometry(0.06, 10, 10);
      const dotMat = new THREE.MeshBasicMaterial({
        color: socketColor,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const dot = new THREE.Mesh(dotGeom, dotMat);
      dot.position.copy(lp);
      dot.userData.isProductSocket = true;
      dot.userData.productKey = key;
      dot.userData.basePos = lp.clone();

      // A slightly larger invisible hit-sphere on top so taps register.
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false, depthWrite: false }),
      );
      hit.position.copy(lp);
      hit.userData.isProductSocket = true;
      hit.userData.productKey = key;
      this.socketGroup.add(hit);
      this.socketGroup.add(dot);

      // PHASE 3 — electric SIGNAL PULSE travelling toward this dot.
      // A small bright point + a fading trail line drawn each frame.
      const pulseGeo = new THREE.SphereGeometry(0.05, 6, 6);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: socketColor,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const pulse = new THREE.Mesh(pulseGeo, pulseMat);
      pulse.userData.isSignal = true;
      pulse.userData.targetKey = key;
      // Random starting offset along its 0..1 progress so all 6 are
      // staggered (so users see ALL nodes signal sequentially).
      pulse.userData.t = i / Math.max(1, productKeys.length);
      pulse.userData.speed = 0.35 + srand() * 0.25;
      // Random branch origin point (near the orb surface, opposite side).
      const ogAngle = angle + Math.PI + (srand() - 0.5) * 0.8;
      const ogElev  = (srand() - 0.5) * 1.4;
      const ogR     = 2.0 + srand() * 0.6;
      pulse.userData.origin = new THREE.Vector3(
        Math.cos(ogAngle) * Math.cos(ogElev) * ogR,
        Math.sin(ogElev) * ogR,
        Math.sin(ogAngle) * Math.cos(ogElev) * ogR,
      );
      pulse.userData.target = lp.clone();
      this.signalGroup.add(pulse);
    }
  }

  setHomePosition(p: THREE.Vector3) {
    this.home.copy(p);
    this.group.position.copy(p);
    this.trail.reset(p);
  }

  setVisible(v: boolean) {
    this.visibleState = v;
    if (!v) {
        this.group.visible = false;
        this.trailGroup.visible = false;
    } else {
        this.group.visible = true;
        this.trailGroup.visible = true;
    }
  }

  setScale(s: number) {
    this.scale = s;
    this.group.scale.setScalar(s);
  }

  reset() {
    this.scale = 1;
    this.group.scale.setScalar(1);
    this.trail.reset(this.home);
    this.group.position.copy(this.home);
    this.arrival.set(0, 0, 0);
    this.arrivalSpring.reset();
    this.arrivalActive = false;
    this.lastT = -1;
  }

  /**
   * Trigger a non-linear arrival — orb floats in from `offset` and springs
   * back to home using critically-damped physics (stiffness/damping defaults
   * are the "arrogant" feel: 6.0 / 3.5).
   */
  setArrivalOffset(offset: THREE.Vector3, _duration = 1.6) {
    this.arrival.copy(offset);
    this.arrivalSpring.reset();
    // Give it a tiny inward velocity so it eases in instead of starting still.
    const inward = offset.clone().multiplyScalar(-0.35);
    this.arrivalSpring.velocity.copy(inward);
    this.arrivalActive = true;
  }

  burst() {
    gsap.to(this, {
      scale: 22.0,
      duration: 0.9,
      ease: 'power4.out',
    });
  }

  // Cinematic magnify (smaller, contained). Used when a Shunya orb is clicked
  // to open its glass slab — exactly mirrors the Vyōma orb's behaviour scale
  // pattern but stops at a slab-friendly size instead of warping.
  public magnifyFactor = 1.0;
  magnify(target = 2.6, duration = 0.55) {
    gsap.to(this, { magnifyFactor: target, duration, ease: 'power3.out', overwrite: true });
  }
  contract(duration = 0.55) {
    gsap.to(this, { magnifyFactor: 1.0, duration, ease: 'power3.in', overwrite: true });
  }

  open() {}
  close() {}

  update(
    t: number,
    energy: number,
    active: boolean,
    panelOpen: boolean,
    focus = 1,
    motion = 1,
    overridePosition?: THREE.Vector3
  ) {
    if (!this.visibleState) return;

    // Derive frame delta from t (the caller passes the global clock time).
    const dt = this.lastT < 0 ? 0.016 : Math.max(0.001, Math.min(0.05, t - this.lastT));
    this.lastT = t;

    const presence = panelOpen ? 1 : THREE.MathUtils.clamp(focus, 0, 1);

    if (overridePosition) {
      this.group.position.copy(overridePosition);
    } else {
      const drift = new THREE.Vector3(
        Math.sin(t * 0.18 + this.seed) * 0.05,
        Math.cos(t * 0.15 + this.seed * 1.3) * 0.042,
        Math.sin(t * 0.12 + this.seed * 0.7) * 0.038
      ).multiplyScalar(motion);

      const circle = new THREE.Vector3(
        Math.cos(t * 0.44 + this.seed * 0.41) * 3.2 * presence,
        Math.sin(t * 0.39 + this.seed * 0.77) * 2.8 * presence,
        Math.sin(t * 0.22 + this.seed * 0.93) * 6.0 * presence
      ).multiplyScalar(motion);

      this.group.position.copy(this.home).add(drift).add(circle);
    }

    // Apply arrogant-spring arrival decay. The arrival vector itself springs
    // toward (0,0,0) — stiffer arrival params (12 / 6.8) for ~1.4s settle,
    // while the continuous path-following spring (in CameraRig) stays at the
    // user-specified soft (6 / 3.5) "arrogant" feel.
    if (this.arrivalActive) {
      const ZERO = new THREE.Vector3(0, 0, 0);
      this.arrivalSpring.step(this.arrival, ZERO, dt, 12.0, 6.8);
      this.group.position.add(this.arrival);
      if (this.arrival.lengthSq() < 0.0006 && this.arrivalSpring.velocity.lengthSq() < 0.0008) {
        this.arrival.set(0, 0, 0);
        this.arrivalSpring.reset();
        this.arrivalActive = false;
      }
    }

    const pulse = 1 + Math.sin(t * 1.5 + this.seed) * 0.045 + energy * 0.06;
    // EQUALIZATION (item 2): keep all orbs visually substantial even when
    // partially out-of-focus, and let the focused orb confidently fill the
    // frame. Floor 0.92x, focus boost up to ~1.32x — uniform across all 6
    // Shunya orbs so Medhā / Sandhi never feel small or distant.
    const baseScale = ((active ? 1.10 : 1.0) * pulse) * (0.92 + presence * 0.40);
    // PHASE 2: in-place unfold. expansionT 0..1 multiplies size up to ~1.7x.
    // We keep the orb comfortably in-frame so the user can read the slabs
    // anchored to its sockets.
    const expT = (this as any).expansionT ?? 0;
    const unfoldEase = expT < 0.5 ? 2 * expT * expT : 1 - Math.pow(-2 * expT + 2, 2) / 2;
    const expandScale = 1 + unfoldEase * 0.7;
    const targetScale = baseScale * expandScale;

    if (this.scale < 10) {
        this.scale += (targetScale - this.scale) * 0.08;
    }
    this.group.scale.setScalar(this.scale * (panelOpen ? 1.08 : 1.0) * this.magnifyFactor);

    // ORB MOTION
    this.group.rotation.y += 0.15 * motion * 0.016; // Approx dt=.016
    this.group.rotation.x = Math.sin(t * 0.18) * 0.18;
    this.group.rotation.z = Math.cos(t * 0.11) * 0.08;

    // NODE TURBULENCE
    const posAttr = this.nodeGeo.attributes.position;
    for (let i = 0; i < this.NODE_COUNT; i++) {
        const base = this.nodeBase[i];
        const ix = i * 3;
        posAttr.array[ix] = base.x + Math.sin(t * 1.4 + base.phase) * 0.04;
        posAttr.array[ix + 1] = base.y + Math.cos(t * 1.8 + base.phase) * 0.04;
        posAttr.array[ix + 2] = base.z + Math.sin(t * 1.2 + base.phase) * 0.05;
    }
    posAttr.needsUpdate = true;

    // NETWORK SHIMMER — signal-state-driven brightness and pulse.
    // CRITICAL FIX: branches DIM as expansionT rises so the electric signals
    // travelling toward each clickable product node are clearly visible.
    const expT2 = (this as any).expansionT ?? 0;
    const signal = (this as any).signal as string;
    const dim = (this as any).visualDim ?? 1;
    let signalBoost = 0;
    let signalPulse = 0;
    if (signal === 'hover')        { signalBoost = 0.05; signalPulse = 0.04; }
    else if (signal === 'listening'){ signalBoost = 0.08; signalPulse = 0.06; }
    else if (signal === 'processing'){ signalBoost = 0.10; signalPulse = 0.10; }
    else if (signal === 'response') { signalBoost = 0.14; signalPulse = 0.14; }
    else if (signal === 'interaction'){ signalBoost = 0.06; signalPulse = 0.05; }
    else if (signal === 'decay')    { signalBoost = 0.02; signalPulse = 0.0; }
    const pulseFreq = signal === 'processing' ? 3.8 : signal === 'response' ? 5.2 : 2.4;
    // INVERT: web fades down as expansion grows, so signals show through.
    const webBase = 0.30 * (1 - expT2 * 0.68) + signalBoost;
    this.web.material.opacity = (webBase + Math.sin(t * pulseFreq) * (0.06 + signalPulse * 0.5)) * dim;
    // Nodes (the orb's intrinsic web-junctions) also dim.
    this.nodeMat.opacity = (0.82 * (1 - expT2 * 0.55) + Math.sin(t * 1.7) * 0.06 + signalBoost) * dim;

    // CORE TURBULENCE
    this.coreDust.rotation.y += 0.08 * motion * 0.016;
    this.coreDust.rotation.x -= 0.03 * motion * 0.016;
    this.haze.rotation.y -= 0.015 * motion * 0.016;
    this.haze.rotation.z += 0.01 * motion * 0.016;

    // Apply visual dim to other materials.
    (this.haze.material as THREE.PointsMaterial).opacity = 0.12 * dim * (1 - expT2 * 0.5);
    (this.coreDust.material as THREE.Material).opacity = (0.82 + Math.sin(t * 2.5) * 0.08) * dim;
    (this.dust.material as THREE.PointsMaterial).opacity = 0.22 * dim;

    // SATELLITES
    this.satellites.children.forEach((c, i) => {
        c.rotation.x += 0.016 * motion * (0.12 + i * 0.01);
        c.rotation.y += 0.016 * motion * (0.18 + i * 0.01);
        c.position.y += Math.sin(t + i) * 0.0008 * motion;
    });

    // DUST
    this.dust.rotation.y += 0.003 * motion * 0.016;
    this.dust.rotation.x += 0.001 * motion * 0.016;

    // PHASE 3 v2 — clickable PRODUCT NODES + electrifying SIGNAL PULSES.
    // Only render when sockets are enabled AND expansion > 0.
    if (this.socketGroup && this.signalGroup) {
      const expForSockets = (this as any).expansionT ?? 0;
      const visible = expForSockets > 0.05 && this.socketGroup.children.length > 0;
      this.socketGroup.visible = visible;
      this.signalGroup.visible = visible;

      if (visible) {
        const spectrumHi: THREE.Color | undefined = (this as any).spectrumHi;
        // -- DOTS: tiny pulsating intersection points. --
        for (const c of this.socketGroup.children) {
          const isHit = !(c as any).geometry || !(c as any).material || ((c as any).material as any).visible === false;
          const m = (c as any).material as THREE.MeshBasicMaterial | undefined;
          if (!m) continue;
          if (isHit) continue; // skip invisible hit-spheres
          // Stagger fade-in.
          const fadeIn = Math.min(1, Math.max(0, (expForSockets - 0.2) / 0.6));
          // Soft glittering pulse so the dots feel ALIVE.
          const idx = (c as any).id ?? 0;
          const pulseAmt = 0.7 + Math.sin(t * 3.2 + idx) * 0.30;
          m.opacity = fadeIn * pulseAmt;
          if (spectrumHi && (m as any).color) (m as any).color = spectrumHi;
          // Slight breathing in scale.
          const s = 1 + Math.sin(t * 3.0 + idx) * 0.18;
          c.scale.setScalar(s);
        }

        // -- SIGNAL PULSES: travel from origin → target, draw fading trail. --
        for (const pulse of this.signalGroup.children) {
          const p: any = pulse;
          p.userData.t += dt * (p.userData.speed ?? 0.4);
          if (p.userData.t > 1.15) p.userData.t = -0.15;
          const tt = Math.max(0, Math.min(1, p.userData.t));
          const origin: THREE.Vector3 = p.userData.origin;
          const target: THREE.Vector3 = p.userData.target;
          // Bezier-ish curve via mid-point arc for visual richness.
          const mid = origin.clone().add(target).multiplyScalar(0.5);
          mid.y += 0.5; // arc upward
          // Quadratic bezier: B(t) = (1-t)²P0 + 2(1-t)t·P1 + t²P2
          const omt = 1 - tt;
          const px = omt * omt * origin.x + 2 * omt * tt * mid.x + tt * tt * target.x;
          const py = omt * omt * origin.y + 2 * omt * tt * mid.y + tt * tt * target.y;
          const pz = omt * omt * origin.z + 2 * omt * tt * mid.z + tt * tt * target.z;
          pulse.position.set(px, py, pz);
          const mat = (pulse as any).material as THREE.MeshBasicMaterial;
          // Bright in middle, fade at ends.
          const env = Math.sin(tt * Math.PI);
          mat.opacity = env * Math.min(1, expForSockets * 1.6);
          if (spectrumHi) mat.color = spectrumHi;
          // Slight glow scale near target so it feels like impact.
          const burst = 1 + (tt > 0.85 ? (tt - 0.85) * 8 : 0);
          pulse.scale.setScalar(burst);
        }
      }
    }

    this.trail.update(this.group.position, 1, 1, t);
  }

  // ============================================================
  // PHASE 1 — InteractionState driver API.
  // Called by ShunyaRealm when the InteractionState target matches this orb.
  // Phase 2 will use these to drive the actual visual unfolding (shader
  // uniforms, branch growth, signal flow). For now they're tracked as plain
  // members so the wiring is testable.
  // ============================================================
  setExpansionProgress(t: number) {
    (this as any).expansionT = Math.max(0, Math.min(1, t));
  }
  setSignal(s: string) {
    (this as any).signal = s;
  }
  setSpectrumHex(loHex: string, hiHex: string) {
    try {
      (this as any).spectrumLo = new THREE.Color(loHex);
      (this as any).spectrumHi = new THREE.Color(hiHex);
    } catch {}
  }
  getExpansionProgress(): number { return (this as any).expansionT ?? 0; }

  /** Sibling-orb dim factor (0..1). When another orb is unfolded, set this <1 to fade. */
  setVisualDim(v: number) {
    (this as any).visualDim = Math.max(0, Math.min(1, v));
  }

  /**
   * Compute the world position of one of 6 unfold-sockets surrounding this orb.
   * Anchors React product slabs in screen-space for Vistāra.
   * The sockets sit on a ring of radius proportional to expansionT so they
   * smoothly fly out from the orb's center as it unfolds.
   */
  getSocketWorld(socketIdx: number, totalSockets: number = 6): THREE.Vector3 {
    const expT = (this as any).expansionT ?? 0;
    const baseRadius = 3.4 + expT * 2.8;   // world units from orb center
    const angle = (socketIdx / totalSockets) * Math.PI * 2 - Math.PI / 2;
    // Tilt the ring slightly so we don't get perfect symmetry.
    const yJitter = Math.sin(socketIdx * 1.7) * 0.4;
    const local = new THREE.Vector3(
      Math.cos(angle) * baseRadius,
      Math.sin(angle) * baseRadius * 0.55 + yJitter,
      0
    );
    // Transform local → world via group matrix.
    return local.applyMatrix4(this.group.matrixWorld);
  }

  /** Project the orb's centre to NDC (-1..1) using a camera. */
  getScreenNDC(camera: THREE.Camera): { x: number; y: number; visible: boolean } {
    const p = this.group.position.clone().project(camera);
    return { x: p.x, y: p.y, visible: p.z > -1 && p.z < 1 };
  }
}

