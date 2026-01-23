export class Lexicon {
  constructor(data) {
    this.data = data || {};
  }

  get(path) {
    if (!path) return "";
    const parts = path.split(".");
    let node = this.data;
    for (const part of parts) {
      if (!node || typeof node !== "object") return path;
      node = node[part];
    }
    if (node === undefined || node === null) return path;
    return String(node);
  }

  template(path, vars) {
    const base = this.get(path);
    if (!base || typeof base !== "string") return base;
    return base.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
      if (!vars || vars[key] === undefined) return match;
      return String(vars[key]);
    });
  }
}
