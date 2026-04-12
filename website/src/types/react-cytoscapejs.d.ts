declare module 'react-cytoscapejs' {
  import { Component } from 'react';
  import { Core, StylesheetStyle, LayoutOptions, ElementDefinition } from 'cytoscape';

  interface Props {
    id?: string;
    cy?: (cy: Core) => void;
    elements: ElementDefinition[];
    style?: React.CSSProperties;
    layout?: LayoutOptions;
    stylesheet?: StylesheetStyle | StylesheetStyle[];
    className?: string;
    enabled?: boolean;
    grabbedNode?: unknown;
    maxZoom?: number;
    minZoom?: number;
    zoomingEnabled?: boolean;
    userZoomingEnabled?: boolean;
    boxSelectionEnabled?: boolean;
    autoungrabify?: boolean;
    autounselectify?: boolean;
  }

  export default class CytoscapeComponent extends Component<Props> {}
}
