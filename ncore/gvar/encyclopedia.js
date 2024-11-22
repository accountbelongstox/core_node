class Encyclopedia {
  encyclopedia = {};

  setEncyclopedia(obj) {
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        this.encyclopedia[key] = obj[key];
      }
    }
  }

  getEncyclopedia(key) {
    if (key) {
      return this.encyclopedia[key];
    }
    return this.encyclopedia;
  }

  setEncyclopediaByKey(key, val) {
    if (key && val) {
      this.encyclopedia[key] = val;
    }
  }
}

export default new Encyclopedia();
