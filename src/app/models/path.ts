import {Expose, Type} from "class-transformer";
import {Graph} from "./graph";

export class Path {
  @Expose() @Type( () => Graph) start: Graph;
  @Expose() @Type( () => Graph) property: Graph;
  @Expose() @Type( () => Graph) end: Graph;
  @Expose() path: any;
  @Expose() index: any;
}
