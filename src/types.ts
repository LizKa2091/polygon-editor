export interface IPoint {
   x: number;
   y: number;
}

export interface IPolygon {
   id: string;
   points: IPoint[];
   color: string;
   isSelected: boolean;
}

export interface ICommand {
   execute(): void;
   undo(): void;
}