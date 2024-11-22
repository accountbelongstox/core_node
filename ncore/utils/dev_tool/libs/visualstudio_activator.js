
    
    async isVisualStudio(callback) {
        let vs
        try {
            vs = await this.queryRegistry("HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\VisualStudio\\SxS\\VS7")
        } catch (e) {
            vs = null
        }
        if (callback) callback(vs)
    }
