export function approvedDrawioOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password ? url.origin : null;
  } catch { return null; }
}

export function diagramPayload(kind: string, source: string) {
  if (kind === 'drawio') {
    const xml = new DOMParser().parseFromString(source, 'application/xml');
    if (xml.querySelector('parsererror') || !['mxfile', 'mxGraphModel'].includes(xml.documentElement.tagName) || /<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('올바른 Draw.io XML을 입력해 주세요.');
    return new File([source], 'diagram.drawio', { type: 'application/octet-stream' });
  }
  if (kind === 'excalidraw') {
    const scene = JSON.parse(source);
    if (scene.type !== 'excalidraw' || !Array.isArray(scene.elements) || !scene.appState || typeof scene.appState !== 'object' || !scene.files || typeof scene.files !== 'object') throw new Error('올바른 Excalidraw 장면을 입력해 주세요.');
    return new File([source], 'diagram.excalidraw', { type: 'application/json' });
  }
  return new File([source], 'diagram.mmd', { type: 'text/plain' });
}

export function defaultDiagramSource(kind: string) {
  if (kind === 'drawio') return '<mxfile><diagram name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
  if (kind === 'excalidraw') return '{"type":"excalidraw","version":2,"source":"knowledge-engine","elements":[],"appState":{},"files":{}}';
  return 'graph TD\n  A --> B';
}
