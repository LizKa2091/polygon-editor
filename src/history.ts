import { ICommand } from "./types";

export class HistoryManager {
   private undoStack: ICommand[] = [];
   private redoStack: ICommand[] = [];

   execute(command: ICommand) {
      command.execute();
       
      this.undoStack.push(command);
      this.redoStack = [];
   }

   undo() {
      const command = this.undoStack.pop();

      if (command) {
         command.undo();
         this.redoStack.push(command);
      }
   }

   redo() {
      const command = this.redoStack.pop();
      
      if (command) {
         command.execute();
         this.undoStack.push(command);
      }
   }
}