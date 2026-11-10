// jsdom has no layout engine, so CodeMirror's measuring code needs these stubs.
const rect = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: 0,
  height: 0,
  toJSON() {
    return this;
  },
};

if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = function getClientRects() {
    return Object.assign([rect], { item: () => rect }) as unknown as DOMRectList;
  };
}

if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return rect as DOMRect;
  };
}

if (!HTMLElement.prototype.getClientRects) {
  HTMLElement.prototype.getClientRects = function getClientRects() {
    return Object.assign([rect], { item: () => rect }) as unknown as DOMRectList;
  };
}

if (!HTMLElement.prototype.getBoundingClientRect) {
  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return rect as DOMRect;
  };
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
