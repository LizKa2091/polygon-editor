import { IPolygon, IPoint, ICommand } from '../types';
import { HistoryManager } from '../history';

export class PolygonEditor extends HTMLElement {
   private canvas: HTMLCanvasElement;
   private ctx: CanvasRenderingContext2D;
   private polygons: IPolygon[] = [];
   private history = new HistoryManager();
   private selectedId: string | null = null;

   private isDragging = false;
   private dragStartMouse: IPoint = { x: 0, y: 0 };
   private startPoints: IPoint[] = [];

   constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot!.innerHTML = `
         <style>
            :host { display: flex; flex-direction: column; height: 100vh; font-family: sans-serif; }
            .toolbar { padding: 15px; background: #f8f9fa; border-bottom: 1px solid #dee2e6; display: flex; gap: 10px; }
            .info { padding: 5px 15px; font-size: 12px; color: #666; }
            canvas { flex-grow: 1; background: #fff; touch-action: none; }
            button { padding: 8px 12px; cursor: pointer; border-radius: 6px; border: 1px solid #ccc; background: white; transition: 0.2s; }
            button:hover { background: #e9ecef; }
            button:active { transform: translateY(0); box-shadow: none; }
            .btn-danger { color: #d93025; }
         </style>
         <div class="toolbar">
            <button id="add">Сгенерировать</button>
            <button id="delete" class="btn-danger">Удалить</button>
            <button id="clear">Очистить всё</button>
            <button id="undo">Отменить (Ctrl + Z)</button>
            <button id="redo">Вернуть (Ctrl + Y)</button>
         </div>
         <div class="info" id="status">Полигонов: 0</div>
         <canvas id="canvas"></canvas>
      `;

      this.canvas = this.shadowRoot!.getElementById('canvas') as HTMLCanvasElement;
      this.ctx = this.canvas.getContext('2d')!;
   }

   connectedCallback() {
      window.addEventListener('resize', () => this.resize());

      this.shadowRoot!.getElementById('add')?.addEventListener('click', () => this.addPolygon());
      this.shadowRoot!.getElementById('delete')?.addEventListener('click', () => this.deleteSelected());
      this.shadowRoot!.getElementById('clear')?.addEventListener('click', () => this.clearAll());
      this.shadowRoot!.getElementById('undo')?.addEventListener('click', () => { this.history.undo(); this.render(); });
      this.shadowRoot!.getElementById('redo')?.addEventListener('click', () => { this.history.redo(); this.render(); });
      
      this.canvas.addEventListener('mousedown', (e) => this.handleSelect(e));
      window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
      window.addEventListener('mouseup', () => this.handleMouseUp());

      window.addEventListener('keydown', (e) => this.handleKeyDown(e));

      this.resize();
   }

   private undo() {
      this.history.undo();
      this.render();
   }

   private redo() {
      this.history.redo();
      this.render();
   }

   private handleSelect(e: MouseEvent) {
      const rect = this.canvas.getBoundingClientRect();
      const mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      
      const hit = [...this.polygons].reverse().find((p) => this.isPointInPoly(mouse, p));

      if (hit) {
         this.isDragging = true;
         this.selectedId = hit.id;
         this.startPoints = hit.points.map((p) => ({...p}));
         this.dragStartMouse = mouse;
      }
      else {
         this.selectedId = null;
      }

      this.selectedId = hit ? hit.id : null;
      this.render();
   }

   private handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && (e.key === 'z' || e.key === 'я')) {
         e.preventDefault();

         this.undo();
      }
      if (e.ctrlKey && (e.key === 'y' || e.key === 'н' || (e.shiftKey && (e.key === 'Z' || e.key === 'Я')))) {
         e.preventDefault();

         this.redo();
      }
      if (e.key === 'Delete') {
         this.deleteSelected();
      }
   }

   private handleMouseDown(e: MouseEvent) {
      const rect = this.canvas.getBoundingClientRect();
      const mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      
      const hit = [...this.polygons].reverse().find((p) => this.isPointInPoly(mouse, p));

      if (hit) {
         this.isDragging = true;
         this.selectedId = hit.id;
         this.startPoints = hit.points.map((p) => ({...p}));
         this.dragStartMouse = mouse;
      } 
      else {
         this.selectedId = null;
      }

      this.render();
   }

   private handleMouseMove(e: MouseEvent) {
      if (!this.isDragging || !this.selectedId) return;

      const rect = this.canvas.getBoundingClientRect();
      const mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      const dx = mouse.x - this.dragStartMouse.x;
      const dy = mouse.y - this.dragStartMouse.y;

      this.move(dx, dy);
   }

   private handleMouseUp() {
      if (this.isDragging && this.selectedId) {
         const poly = this.polygons.find((p) => p.id === this.selectedId);

         if (poly) {
            const endPoints = poly.points.map((p) => ({...p}));
            const initialPoints = [...this.startPoints];

            if (JSON.stringify(initialPoints) !== JSON.stringify(endPoints)) {
               const polyId = this.selectedId;
               const moveCmd: ICommand = {
                  execute: () => {
                     const p = this.polygons.find(x => x.id === polyId);
                     if (p) p.points = endPoints;
                  },
                  undo: () => {
                     const p = this.polygons.find(x => x.id === polyId);
                     if (p) p.points = initialPoints;
                  }
               };
               this.history.execute(moveCmd);
            }
         }
      }
      this.isDragging = false;
      this.render();
   }

   private move(dx: number, dy: number) {
      const poly = this.polygons.find((p) => p.id === this.selectedId);
      if (!poly) return;
      
      poly.points = this.startPoints.map((p) => {
         let nx = p.x + dx;
         let ny = p.y + dy;

         nx = Math.max(0, Math.min(this.canvas.width, nx));
         ny = Math.max(0, Math.min(this.canvas.height, ny));
         return { x: nx, y: ny };
      });

      this.render();
   }

   private isPointInPoly(pt: IPoint, poly: IPolygon) {
      let isInside = false;

      for (let i=0, j = poly.points.length - 1; i < poly.points.length; j = i++) {
         if (((poly.points[i].y > pt.y) !== (poly.points[j].y > pt.y)) &&
            (pt.x < (poly.points[j].x - poly.points[i].x) * (pt.y - poly.points[i].y) / (poly.points[j].y - poly.points[i].y) + poly.points[i].x))
               isInside = !isInside;
      }

      return isInside;
   }

   private deleteSelected() {
      if (!this.selectedId) return alert("Полигон не выбран!");

      const target = this.polygons.find((p) => p.id === this.selectedId)!;
      const cmd: ICommand = {
         execute: () => { 
            this.polygons = this.polygons.filter((p) => p.id !== target.id); 
            this.selectedId = null; 
            this.render();
         },
         undo: () => { 
            this.polygons.push(target); 
            this.render();
         }
      };
      
      this.history.execute(cmd);
      this.render();
   }

   private clearAll() {
      if (this.polygons.length === 0) return;

      const oldPolygons = [...this.polygons];
      const cmd: ICommand = {
         execute: () => { 
            this.polygons = []; 
            this.selectedId = null; 
            this.render(); 
         },
         undo: () => { 
            this.polygons = oldPolygons; 
            this.render(); 
         }
      };

      this.history.execute(cmd);
      this.render();
   }

   private resize() {
      this.canvas.width = this.canvas.clientWidth;
      this.canvas.height = this.canvas.clientHeight;

      this.render();
   }

   private addPolygon() {
      const id = Math.random().toString(36).substring(2, 9);
      const color = `hsl(${Math.random() * 360}, 70%, 60%)`;
      const vertices = Math.floor(Math.random() * 5) + 3;
      const radius = 30 + Math.random() * 20;
      
      const center = { 
         x: Math.max(radius, Math.min(this.canvas.width - radius, Math.random() * this.canvas.width)), 
         y: Math.max(radius, Math.min(this.canvas.height - radius, Math.random() * this.canvas.height)) 
      };
      
      const points: IPoint[] = [];
      for (let i=0; i<vertices; i++) {
         const a = (i / vertices) * Math.PI * 2;
         points.push({ x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius });
      }

      const poly: IPolygon = { id, points, color, isSelected: false, scale: 0 };

      const cmd: ICommand = {
         execute: () => { 
            this.polygons.push(poly); 
            this.animateNewPolygon(poly);
         },
         undo: () => { 
            this.polygons = this.polygons.filter((p) => p.id !== id); 
            this.render();
         }
      };
      
      this.history.execute(cmd);
      this.render();
   }

   private animateNewPolygon(poly: IPolygon) {
      const duration = 300;
      const start = performance.now();

      const step = (now: number) => {
         const progress = Math.min(1, (now-start) / duration);
         poly.scale = progress;
         this.render();

         if (progress < 1) {
            requestAnimationFrame(step);
         }
      };
      requestAnimationFrame(step);
   }

   private render() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      this.polygons.forEach((p) => {
         this.ctx.save();
         
         if (p.scale !== undefined && p.scale < 1) {
            const cx = p.points.reduce((sum, pt) => sum + pt.x, 0) / p.points.length;
            const cy = p.points.reduce((sum, pt) => sum + pt.y, 0) / p.points.length;

            this.ctx.translate(cx, cy);
            this.ctx.scale(p.scale, p.scale);
            this.ctx.translate(-cx, -cy);
         }

         this.ctx.beginPath();
         this.ctx.moveTo(p.points[0].x, p.points[0].y);
         p.points.forEach((pt: { x: number; y: number; }) => this.ctx.lineTo(pt.x, pt.y));
         this.ctx.closePath();

         this.ctx.fillStyle = p.color;
         this.ctx.fill();

         const isSelected = p.id === this.selectedId;
         this.ctx.strokeStyle = isSelected ? '#000' : '#666';
         this.ctx.lineWidth = isSelected ? 4 : 2;
         this.ctx.stroke();

         this.ctx.restore();
      });

      const selected = this.polygons.find(p => p.id === this.selectedId);
      const statusText = `Полигонов: ${this.polygons.length} | ${selected ? 'Выбран: ' + selected.id : 'Ничего не выбрано'}`;
      this.shadowRoot!.getElementById('status')!.textContent = statusText;
   }
}
customElements.define('polygon-editor', PolygonEditor);