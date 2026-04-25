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
         </style>
         <div class="toolbar">
            <button id="add">Сгенерировать</button>
            <button id="undo">Отменить</button>
            <button id="redo">Повторить</button>
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
      this.shadowRoot!.getElementById('undo')?.addEventListener('click', () => { this.history.undo(); this.render(); });
      this.shadowRoot!.getElementById('redo')?.addEventListener('click', () => { this.history.redo(); this.render(); });
      
      this.canvas.addEventListener('mousedown', (e) => this.handleSelect(e));
      window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
      window.addEventListener('mouseup', () => this.handleMouseUp());

      this.shadowRoot!.getElementById('delete')?.addEventListener('click', () => this.deleteSelected());

      this.resize();
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
            const endPoints = poly.points.map(p => ({...p}));
            const initialPoints = [...this.startPoints];

            const moveCmd: ICommand = {
               execute: () => {
                  const p = this.polygons.find((x) => x.id === poly.id);
                  if (p) p.points = endPoints;

                  this.render();
               },
               undo: () => {
                  const p = this.polygons.find((x) => x.id === poly.id);
                  if (p) p.points = initialPoints;

                  this.render();
               }
            };
            this.history.execute(moveCmd); 
         }
      }

      this.isDragging = false;
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

      for (let i = 0, j = poly.points.length - 1; i < poly.points.length; j = i++) {
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
            this.polygons = this.polygons.filter((p) => p.id !== target.id); this.selectedId = null; 
         },
         undo: () => { 
            this.polygons.push(target); 
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
      const center = { x: Math.random() * (this.canvas.width - 100) + 50, y: Math.random() * (this.canvas.height - 100) + 50 };
      
      const points: IPoint[] = [];
      const vertices = Math.floor(Math.random() * 5) + 3;

      for (let i=0; i<vertices; i++) {
         const a = (i / vertices) * Math.PI * 2;
         const r = 30 + Math.random() * 20;

         points.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
      }

      const poly: IPolygon = {
         id, points, color,
         isSelected: false
      };

      const cmd: ICommand = {
         execute: () => { this.polygons.push(poly); },
         undo: () => { 
            this.polygons = this.polygons.filter((p) => p.id !== id); 
         }
      };
      
      this.history.execute(cmd);
      this.render();
   }

   private render() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      this.polygons.forEach(p => {
         this.ctx.beginPath();
         this.ctx.moveTo(p.points[0].x, p.points[0].y);
         p.points.forEach((pt: { x: number; y: number; }) => this.ctx.lineTo(pt.x, pt.y));
         this.ctx.closePath();

         this.ctx.fillStyle = p.color;
         this.ctx.fill();

         this.ctx.strokeStyle = p.id === this.selectedId ? '#000' : '#666';
         this.ctx.lineWidth = p.id === this.selectedId ? 3 : 1;
         this.ctx.stroke();
      });
      this.shadowRoot!.getElementById('status')!.textContent = `Полигонов: ${this.polygons.length}`;
   }
}
customElements.define('polygon-editor', PolygonEditor);