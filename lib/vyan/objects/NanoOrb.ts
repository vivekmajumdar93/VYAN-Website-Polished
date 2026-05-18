import * as THREE from 'three';
import gsap from 'gsap';
import { OrbDustTrail } from './OrbDustTrail';

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

  constructor(data: NanoOrbData, radius: number = 1.65, _networkSize: number = 4200) {
    this.data = data;
    this.seed = Math.random() * 1000;

    const nodePos = [];
    const nodeCols = [];
    const nodes = [];

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

    this.trail = new OrbDustTrail('#a066ff');
    this.trailGroup.add(this.trail.group);

    this.group.visible = false;
    this.trailGroup.visible = false;
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
  }

  burst() {
    gsap.to(this, {
      scale: 22.0,
      duration: 0.9,
      ease: 'power4.out',
    });
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

    const pulse = 1 + Math.sin(t * 1.5 + this.seed) * 0.045 + energy * 0.06;
    const targetScale = ((active ? 1.08 : 0.98) * pulse) * (0.8 + presence * 0.38);

    if (this.scale < 10) {
        this.scale += (targetScale - this.scale) * 0.08;
    }
    this.group.scale.setScalar(this.scale * (panelOpen ? 1.08 : 1.0));

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

    // NETWORK SHIMMER
    this.web.material.opacity = 0.3 + Math.sin(t * 2.4) * 0.1;
    this.nodeMat.opacity = 0.82 + Math.sin(t * 1.7) * 0.08;

    // CORE TURBULENCE
    this.coreDust.rotation.y += 0.08 * motion * 0.016;
    this.coreDust.rotation.x -= 0.03 * motion * 0.016;
    this.haze.rotation.y -= 0.015 * motion * 0.016;
    this.haze.rotation.z += 0.01 * motion * 0.016;
    (this.coreDust.material as THREE.Material).opacity = 0.82 + Math.sin(t * 2.5) * 0.08;

    // SATELLITES
    this.satellites.children.forEach((c, i) => {
        c.rotation.x += 0.016 * motion * (0.12 + i * 0.01);
        c.rotation.y += 0.016 * motion * (0.18 + i * 0.01);
        c.position.y += Math.sin(t + i) * 0.0008 * motion;
    });

    // DUST
    this.dust.rotation.y += 0.003 * motion * 0.016;
    this.dust.rotation.x += 0.001 * motion * 0.016;

    this.trail.update(this.group.position, 1, 1, t);
  }
}

