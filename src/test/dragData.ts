export function dragData() {
  const data = new Map<string, string>();
  return {
    effectAllowed: 'all', dropEffect: 'none', files: [], items: [],
    get types() { return [...data.keys()]; },
    setData(type: string, value: string) { data.set(type, value); },
    getData(type: string) { return data.get(type) || ''; },
    clearData(type?: string) { if (type) data.delete(type); else data.clear(); },
    setDragImage() {},
  };
}
