import { IPoint, IPolygon } from './types';

export const isPointInPolygon = (point: IPoint, polygon: IPolygon): boolean => {
   let isInside = false;

   for (let i=0, j=polygon.points.length - 1; i<polygon.points.length; j = i++) {
      const xi = polygon.points[i].x;
      const yi = polygon.points[i].y;

      const xj = polygon.points[j].x;
      const yj = polygon.points[j].y;

      const intersect = ((yi > point.y) !== (yj > point.y)) &&
         (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);

      if (intersect) isInside = !isInside;
   }

   return isInside;
}

export const polygonsOverlap = (p1: IPolygon, p2: IPolygon): boolean => {
   return p1.points.some((p) => isPointInPolygon(p, p2)) || 
      p2.points.some((p) => isPointInPolygon(p, p1));
}