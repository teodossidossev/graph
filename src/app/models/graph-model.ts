import {Expose, Type} from "class-transformer";
import {Path} from "./path";

export class GraphModel {
  @Expose() @Type(() => Path) bindings: Path[]
}
