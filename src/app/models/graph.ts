import {Expose} from "class-transformer";

export class Graph {
  @Expose() type: string;
  @Expose() value: string;
  @Expose() id: number;p
}
