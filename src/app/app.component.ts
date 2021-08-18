import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import 'reflect-metadata';
import ForceGraph from 'force-graph';
import {plainToClass} from "class-transformer";
import {GraphModel} from "./models/graph-model";
import dataJson from './query-result.json'
import {Path} from "./models/path";
import ForceGraph3D from "3d-force-graph";



@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  @ViewChild('graph',{static: true}) graph!: ElementRef;

  nodes: Map<any,any> = new Map<any, any>();
  links: Map<any,any> = new Map<any, any>();
  rawData: GraphModel;

  public ngOnInit(): void {
    this.initData();
    this.initGraph();
  }

  initData() {
    this.rawData = plainToClass(GraphModel, dataJson.results);
    console.log(this.rawData)
    this.rawData.bindings.forEach(path => {
      // console.log({source: path.start.id, target: path.end.id, value:path.property.value})
      if (!this.nodes.has(path.start.id)) {
        this.nodes.set(path.start.id, {id: path.start.id, label: path.start.value, group: path.path.value});
      }
      if (!this.nodes.has(path.end.id)) {
        this.nodes.set(path.end.id, {id: path.end.id, label: path.end.value, group: path.path.value});
      }
      this.links.set(`${path.start.id}-${path.property.value}-${path.end.id}`,{source: path.start.id, target: path.end.id, label:path.property.value});
    });
  }

  initGraph() {
    // console.log(this.links)

    const gData = {
      nodes: [...this.nodes.values()],
      links: [...this.links.values()]
    };

    // console.log(gData)

    let selfLoopLinks = {};
    let sameNodesLinks = {};
    const curvatureMinMax = 0.5;

    // 1. assign each link a nodePairId that combines their source and target independent of the links direction
    // 2. group links together that share the same two nodes or are self-loops
    gData.links.forEach(link => {
      link.nodePairId = link.source <= link.target ? (link.source + "_" + link.target) : (link.target + "_" + link.source);
      let map = link.source === link.target ? selfLoopLinks : sameNodesLinks;
      if (!map[link.nodePairId]) {
        map[link.nodePairId] = [];
      }
      map[link.nodePairId].push(link);
    });

    // Compute the curvature for self-loop links to avoid overlaps
    Object.keys(selfLoopLinks).forEach(id => {
      let links = selfLoopLinks[id];
      let lastIndex = links.length - 1;
      links[lastIndex].curvature = 1;
      let delta = (1 - curvatureMinMax) / lastIndex;
      for (let i = 0; i < lastIndex; i++) {
        links[i].curvature = curvatureMinMax + i * delta;
      }
    });

    // Compute the curvature for links sharing the same two nodes to avoid overlaps
    Object.keys(sameNodesLinks).filter(nodePairId => sameNodesLinks[nodePairId].length > 1).forEach(nodePairId => {
      let links = sameNodesLinks[nodePairId];
      let lastIndex = links.length - 1;
      let lastLink = links[lastIndex];
      lastLink.curvature = curvatureMinMax;
      let delta = 2 * curvatureMinMax / lastIndex;
      for (let i = 0; i < lastIndex; i++) {
        links[i].curvature = -curvatureMinMax + i * delta;
        if (lastLink.source !== links[i].source) {
          links[i].curvature *= -1; // flip it around, otherwise they overlap
        }
      }
    });

    const highlightNodes = new Set().add(0).add(6);
    const highlightLinks = new Set().add("0_2").add("2_4").add("4_6");

    const graph = ForceGraph()
    (this.graph.nativeElement)
      .linkCurvature('curvature')
      // @ts-ignore
      .linkDirectionalParticleWidth(link => highlightLinks.has(link.nodePairId) ? 4 : 0)
      .linkDirectionalArrowLength(6)
      .linkDirectionalArrowRelPos(1)
      .linkDirectionalParticles(1)
      .linkDirectionalParticleSpeed(0.01)

      // @ts-ignore
      .nodeLabel(node=>node.label)
      .nodeCanvasObject((node: any, ctx)=>{


        ctx.beginPath();
        ctx.arc(node.x, node.y, 4, 0, 2 * Math.PI, false);
        ctx.fillStyle = highlightNodes.has(node.id) ? 'darkorange' : 'rgba(31, 120, 180, 0.92)';
        ctx.fill();

        // estimate fontSize to fit in link length
        const MAX_FONT_SIZE = 3;
        ctx.font = '1px Sans-Serif';
        const fontSize = Math.min(MAX_FONT_SIZE, 40 / ctx.measureText(node.label).width);
        ctx.font = `${fontSize}px Sans-Serif`;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'darkgrey';
        ctx.fillText(node.label, node.x, node.y);
        ctx.restore();
      })
      .graphData(gData)
      .linkCanvasObjectMode(() => 'after')
      .linkCanvasObject((link: any, ctx) => {
        const MAX_FONT_SIZE = 4;
        const LABEL_NODE_MARGIN = graph.nodeRelSize() * 1.5;

        const start = link.source;
        const end = link.target;

        // ignore unbound links
        if (typeof start !== 'object' || typeof end !== 'object') return;

        // calculate label positioning
        const textPos = Object.assign([], ...['x', 'y'].map(c => ({
          [c]: start[c] + (end[c] - start[c]) / 2 // calc middle point
        })));

        const relLink = {x: end.x - start.x, y: end.y - start.y};

        const maxTextLength = Math.sqrt(Math.pow(relLink.x, 2) + Math.pow(relLink.y, 2)) - LABEL_NODE_MARGIN * 2;

        let textAngle = Math.atan2(relLink.y, relLink.x);
        // maintain label vertical orientation for legibility
        if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle);
        if (textAngle < -Math.PI / 2) textAngle = -(-Math.PI - textAngle);

        const label = `${link.label}`;

        // estimate fontSize to fit in link length
        ctx.font = '1px Sans-Serif';
        const fontSize = Math.min(MAX_FONT_SIZE, maxTextLength / ctx.measureText(label).width);
        ctx.font = `${fontSize}px Sans-Serif`;
        const textWidth = ctx.measureText(label).width;
        const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding

        // draw text label (with background rect)
        ctx.save();
        ctx.translate(textPos.x, textPos.y);
        ctx.rotate(textAngle);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(-bckgDimensions[0] / 2, -bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'darkgrey';
        ctx.fillText(label, 0, 0);
        ctx.restore();
      });
  }
}
