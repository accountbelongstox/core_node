
class Encyclopedia{
    encyclopedia = {}
    setEncyclopedia(obj){
		for (let key in obj) {
			this.encyclopedia[key] = obj[key];
		}
    }

    getEncyclopedia(key){
        if(key){
            return this.encyclopedia[key]
        }
        return this.encyclopedia
    }
    
    setEncyclopediaByKey(key,val){
        if(key && val){
            this.encyclopedia[key] = val
        }
    }
}


module.exports = new Encyclopedia()