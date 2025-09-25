
class RawData {
    cidRawData = {}
    cidWsRawDatas = {}

    constructor() {
    }

    setCidRawData(cid, data) {
        this.cidRawData[cid] = data
    }

    getCidRawData(cid, del = false) {
        let result = this.cidRawData[cid]
        if (del) delete this.cidRawData[cid]
        return result
    }

    setWSCidRawData(wsCId, data) {
        let cid = data.cid
        if (!this.cidWsRawDatas[wsCId]) {
            this.cidWsRawDatas[wsCId] = {}
        }
        this.cidWsRawDatas[wsCId][cid] = data
    }

    getWSCidRawData(wsCId, cid) {
        if (this.cidWsRawDatas[wsCId] && this.cidWsRawDatas[wsCId][cid]) {
            let callbak = this.cidWsRawDatas[wsCId][cid]
            delete this.cidWsRawDatas[wsCId][cid]
            return callbak;
        }
        return null;
    }

}

module.exports = RawData