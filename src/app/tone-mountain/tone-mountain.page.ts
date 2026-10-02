import { Component, OnDestroy, ElementRef, ViewChild, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';
import * as THREE from 'three';
import { TtsService } from '../core/services/tts.service';

interface ToneData {
  number: number;
  name: string;
  pattern: string;
  color: string;
  char: string;
  startPitch: number;
  endPitch: number;
}

interface ExampleData {
  char: string;
  jyutping: string;
  meaning: string;
}

@Component({
  selector: 'app-tone-mountain',
  templateUrl: './tone-mountain.page.html',
  styleUrls: ['./tone-mountain.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class ToneMountainPage implements OnDestroy, AfterViewInit {
  @ViewChild('mountainCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  // 默认例字数据
  private defaultChars = ['詩', '史', '試', '時', '市', '事'];
  
  tonesData: ToneData[] = [
    { number: 1, name: '阴平', pattern: '55', color: '#ef4444', char: '詩', startPitch: 5, endPitch: 5 },
    { number: 2, name: '阴上', pattern: '35', color: '#f59e0b', char: '史', startPitch: 3, endPitch: 5 },
    { number: 3, name: '阴去', pattern: '33', color: '#10b981', char: '試', startPitch: 3, endPitch: 3 },
    { number: 4, name: '阳平', pattern: '21', color: '#3b82f6', char: '時', startPitch: 2, endPitch: 1 },
    { number: 5, name: '阳上', pattern: '13', color: '#8b5cf6', char: '市', startPitch: 1, endPitch: 3 },
    { number: 6, name: '阳去', pattern: '22', color: '#ec4899', char: '事', startPitch: 2, endPitch: 2 }
  ];

  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private animationId = 0;
  private toneMeshes: THREE.Mesh[] = [];

  isFlying = false;
  flyProgress = 0;
  currentFlyTone = 0;
  selectedTone: number | null = null;
  showControls = true;

  private isDragging = false;
  private prevX = 0;
  private prevY = 0;
  private theta = Math.PI / 4;
  private phi = Math.PI / 3;
  private dist = 18;
  private pinchDist = 0;

  constructor(
    private router: Router, 
    private route: ActivatedRoute,
    private ngZone: NgZone, 
    private ttsService: TtsService
  ) {
    console.log('[ToneMountain] 构造函数开始');
    // 读取传递的例字数据
    this.route.queryParams.subscribe(params => {
      console.log('[ToneMountain] 收到 queryParams:', params);
      if (params['examples']) {
        try {
          const examples: ExampleData[] = JSON.parse(params['examples']);
          console.log('[ToneMountain] 解析后的 examples:', examples);
          if (examples && examples.length === 6) {
            // 更新 tonesData 中的 char
            examples.forEach((ex, index) => {
              if (this.tonesData[index]) {
                this.tonesData[index].char = ex.char;
              }
            });
            console.log('[ToneMountain] 更新后的 tonesData:', this.tonesData);
          }
        } catch (e) {
          console.error('[ToneMountain] 解析例字数据失败:', e);
        }
      } else {
        console.log('[ToneMountain] 没有收到 examples 参数，使用默认值');
      }
    });
  }

  ngAfterViewInit(): void {
    console.log('[ToneMountain] ngAfterViewInit 开始');
    console.log('[ToneMountain] canvasRef:', this.canvasRef);
    // 延迟初始化，确保 DOM 完全渲染
    setTimeout(() => {
      console.log('[ToneMountain] 延迟后开始初始化');
      this.ngZone.runOutsideAngular(() => this.init());
    }, 300);
  }

  ngOnDestroy(): void {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.renderer) this.renderer.dispose();
  }

  private init(): void {
    console.log('[ToneMountain] init() 开始');
    
    if (!this.canvasRef) {
      console.error('[ToneMountain] canvasRef 为空!');
      return;
    }
    
    const canvas = this.canvasRef.nativeElement;
    console.log('[ToneMountain] canvas 元素:', canvas);
    console.log('[ToneMountain] canvas.clientWidth:', canvas.clientWidth);
    console.log('[ToneMountain] canvas.clientHeight:', canvas.clientHeight);
    console.log('[ToneMountain] canvas.offsetWidth:', canvas.offsetWidth);
    console.log('[ToneMountain] canvas.offsetHeight:', canvas.offsetHeight);
    console.log('[ToneMountain] window.innerWidth:', window.innerWidth);
    console.log('[ToneMountain] window.innerHeight:', window.innerHeight);
    
    // 优先使用 window 尺寸，因为 canvas 的 CSS 高度可能为 0
    const w = window.innerWidth || canvas.clientWidth || canvas.offsetWidth;
    const h = window.innerHeight || canvas.clientHeight || canvas.offsetHeight;
    
    console.log('[ToneMountain] 最终使用尺寸 w:', w, 'h:', h);

    // 确保有有效尺寸
    if (w === 0 || h === 0) {
      console.warn('[ToneMountain] 尺寸为0，延迟初始化');
      setTimeout(() => this.init(), 200);
      return;
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);
    this.scene.fog = new THREE.Fog(0x0f172a, 20, 60);
    console.log('[ToneMountain] Scene 创建成功');

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000);
    this.updateCamera();
    console.log('[ToneMountain] Camera 创建成功');

    // WebGL 渲染器配置 - 增加安卓兼容性
    try {
      console.log('[ToneMountain] 开始创建 WebGLRenderer...');
      this.renderer = new THREE.WebGLRenderer({ 
        canvas, 
        antialias: true,
        alpha: false,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false
      });
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      
      // 强制设置 canvas 尺寸
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      
      // 检查 WebGL 上下文是否有效
      const gl = this.renderer.getContext();
      if (!gl) {
        console.error('[ToneMountain] WebGL 上下文创建失败');
        return;
      }
      console.log('[ToneMountain] WebGL 初始化成功');
      console.log('[ToneMountain] WebGL 版本:', gl.getParameter(gl.VERSION));
      console.log('[ToneMountain] 渲染器尺寸:', this.renderer.getSize(new THREE.Vector2()));
    } catch (e) {
      console.error('[ToneMountain] WebGL 渲染器创建失败:', e);
      return;
    }

    this.addLights();
    console.log('[ToneMountain] 灯光添加成功');
    
    this.addGrid();
    console.log('[ToneMountain] 网格添加成功');
    
    this.createMountains();
    console.log('[ToneMountain] 山脉创建成功');
    
    this.addPitchLabels();
    console.log('[ToneMountain] 音高标签添加成功');
    
    this.bindEvents(canvas);
    console.log('[ToneMountain] 事件绑定成功');
    
    this.loop();
    console.log('[ToneMountain] 渲染循环启动');
  }

  private addLights(): void {
    if (!this.scene) return;
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const d = new THREE.DirectionalLight(0xffffff, 0.8);
    d.position.set(10, 20, 10);
    this.scene.add(d);
  }

  private addGrid(): void {
    if (!this.scene) return;
    const g = new THREE.GridHelper(40, 40, 0x334155, 0x1e293b);
    g.position.y = -0.1;
    this.scene.add(g);
  }

  private createMountains(): void {
    if (!this.scene) return;
    const sp = 4, startX = -((this.tonesData.length - 1) * sp) / 2;
    this.tonesData.forEach((t, i) => {
      this.createRidge(t, startX + i * sp, i);
      this.createLabel(t, startX + i * sp);
    });
  }

  private createRidge(tone: ToneData, x: number, idx: number): void {
    if (!this.scene) return;
    const c = new THREE.Color(tone.color);
    const seg = 40, depth = 10;
    const verts: number[] = [], cols: number[] = [], inds: number[] = [];

    for (let i = 0; i <= seg; i++) {
      const t = i / seg, z = (t - 0.5) * depth, y = this.getH(tone, t);
      verts.push(x, y, z); cols.push(c.r, c.g, c.b);
      verts.push(x - 1.2, 0, z); cols.push(c.r * 0.3, c.g * 0.3, c.b * 0.3);
      verts.push(x + 1.2, 0, z); cols.push(c.r * 0.3, c.g * 0.3, c.b * 0.3);
    }
    for (let i = 0; i < seg; i++) {
      const b = i * 3;
      inds.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b, b + 2, b + 3, b + 2, b + 5, b + 3);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setIndex(inds);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { idx };
    this.toneMeshes.push(mesh);
    this.scene.add(mesh);

    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      pts.push(new THREE.Vector3(x, this.getH(tone, t) + 0.1, (t - 0.5) * depth));
    }
    this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: tone.color })));
  }

  private createLabel(tone: ToneData, x: number): void {
    if (!this.scene) return;
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d')!;
    cv.width = 256; cv.height = 128;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath(); ctx.roundRect(0, 0, 256, 128, 16); ctx.fill();
    ctx.fillStyle = tone.color;
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tone.char, 128, 60);
    ctx.fillStyle = '#fff';
    ctx.font = '22px sans-serif';
    ctx.fillText(`${tone.number}声 ${tone.name}`, 128, 100);
    const tex = new THREE.CanvasTexture(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sp.position.set(x, 6.5, 0);
    sp.scale.set(3.5, 1.75, 1);
    this.scene.add(sp);
  }

  private addPitchLabels(): void {
    if (!this.scene) return;
    for (let p = 1; p <= 5; p++) {
      const y = p * 0.8;
      const cv = document.createElement('canvas');
      const ctx = cv.getContext('2d')!;
      cv.width = 64; cv.height = 64;
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.toString(), 32, 45);
      const tex = new THREE.CanvasTexture(cv);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      sp.position.set(-14, y, 0);
      sp.scale.set(1, 1, 1);
      this.scene.add(sp);
    }
  }

  private getH(tone: ToneData, t: number): number {
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    return (tone.startPitch + (tone.endPitch - tone.startPitch) * e) * 0.8 + Math.sin(t * Math.PI * 3) * 0.15;
  }

  private updateCamera(): void {
    if (!this.camera) return;
    const x = this.dist * Math.sin(this.phi) * Math.cos(this.theta);
    const y = this.dist * Math.cos(this.phi);
    const z = this.dist * Math.sin(this.phi) * Math.sin(this.theta);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 2, 0);
  }

  private bindEvents(c: HTMLCanvasElement): void {
    c.addEventListener('touchstart', (e) => this.onTS(e), { passive: false });
    c.addEventListener('touchmove', (e) => this.onTM(e), { passive: false });
    c.addEventListener('touchend', () => this.isDragging = false);
    c.addEventListener('mousedown', (e) => this.onMD(e));
    c.addEventListener('mousemove', (e) => this.onMM(e));
    c.addEventListener('mouseup', () => this.isDragging = false);
    c.addEventListener('wheel', (e) => this.onWh(e), { passive: false });
    window.addEventListener('resize', () => this.onResize());
  }

  private onTS(e: TouchEvent): void {
    if (this.isFlying) return;
    e.preventDefault();
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.prevX = e.touches[0].clientX;
      this.prevY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      this.pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }

  private onTM(e: TouchEvent): void {
    if (this.isFlying) return;
    e.preventDefault();
    if (e.touches.length === 1 && this.isDragging) {
      this.theta += (e.touches[0].clientX - this.prevX) * 0.01;
      this.phi = Math.max(0.3, Math.min(1.4, this.phi - (e.touches[0].clientY - this.prevY) * 0.01));
      this.prevX = e.touches[0].clientX;
      this.prevY = e.touches[0].clientY;
      this.updateCamera();
    } else if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      this.dist = Math.max(8, Math.min(35, this.dist * this.pinchDist / d));
      this.pinchDist = d;
      this.updateCamera();
    }
  }

  private onMD(e: MouseEvent): void {
    if (this.isFlying) return;
    this.isDragging = true;
    this.prevX = e.clientX;
    this.prevY = e.clientY;
  }

  private onMM(e: MouseEvent): void {
    if (!this.isDragging || this.isFlying) return;
    this.theta += (e.clientX - this.prevX) * 0.005;
    this.phi = Math.max(0.3, Math.min(1.4, this.phi - (e.clientY - this.prevY) * 0.005));
    this.prevX = e.clientX;
    this.prevY = e.clientY;
    this.updateCamera();
  }

  private onWh(e: WheelEvent): void {
    if (this.isFlying) return;
    e.preventDefault();
    this.dist = Math.max(8, Math.min(35, this.dist + e.deltaY * 0.02));
    this.updateCamera();
  }

  private onResize(): void {
    if (!this.camera || !this.renderer) return;
    const c = this.canvasRef.nativeElement;
    const w = c.clientWidth || window.innerWidth;
    const h = c.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private loop(): void {
    this.animationId = requestAnimationFrame(() => this.loop());
    if (this.isFlying) this.fly();
    if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
  }

  private fly(): void {
    if (!this.camera) return;
    this.flyProgress += 0.004;
    if (this.flyProgress >= 1) {
      this.currentFlyTone++;
      if (this.currentFlyTone >= this.tonesData.length) {
        this.ngZone.run(() => this.stopFlying());
        return;
      }
      this.flyProgress = 0;
      this.ngZone.run(() => this.playTone());
    }
    const tone = this.tonesData[this.currentFlyTone];
    const sp = 4, startX = -((this.tonesData.length - 1) * sp) / 2;
    const x = startX + this.currentFlyTone * sp;
    const z = (this.flyProgress - 0.5) * 10;
    const y = this.getH(tone, this.flyProgress) + 3;
    this.camera.position.set(x, y, z - 4);
    this.camera.lookAt(x, y - 1, z + 3);
  }

  goBack(): void { this.router.navigate(['/tones']); }
  toggleControls(): void { this.showControls = !this.showControls; }

  startFlying(): void {
    if (this.isFlying) return;
    this.isFlying = true;
    this.flyProgress = 0;
    this.currentFlyTone = 0;
    this.playTone();
  }

  stopFlying(): void {
    this.isFlying = false;
    this.theta = Math.PI / 4;
    this.phi = Math.PI / 3;
    this.dist = 18;
    this.updateCamera();
  }

  private async playTone(): Promise<void> {
    const t = this.tonesData[this.currentFlyTone];
    this.selectedTone = t.number;
    try { await this.ttsService.speak(t.char); } catch (e) { console.error(e); }
  }

  selectToneByNumber(n: number): void {
    this.selectedTone = n;
    const i = n - 1, tone = this.tonesData[i];
    this.toneMeshes.forEach((m, idx) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = idx === i ? 0.4 : 0;
      mat.emissive = idx === i ? new THREE.Color(tone.color) : new THREE.Color(0);
    });
    this.ttsService.speak(tone.char);
  }

  resetView(): void {
    this.selectedTone = null;
    this.theta = Math.PI / 4;
    this.phi = Math.PI / 3;
    this.dist = 18;
    this.updateCamera();
    this.toneMeshes.forEach(m => {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0;
    });
  }
}
