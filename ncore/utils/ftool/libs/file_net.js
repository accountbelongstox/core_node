

mapNetworkDriveSync(hoststr) {
    let { url, usr, pwd } = this.getShareStringUserPassword(hoststr)
    let networkDriveLetter = `networkDriveLetter_` + url.replace(/[\/\\]+/g, '_');
    let driveLetter
    if (this.hasUserData(networkDriveLetter)) {
        driveLetter = this.getUserData(networkDriveLetter)
        if (!fs.existsSync(`${driveLetter}/`)) {
            driveLetter = this.getUnusedDrives()
            driveLetter = driveLetter.shift()
        } else {
            return driveLetter
        }
    } else {
        driveLetter = this.getUnusedDrives()
        driveLetter = driveLetter.shift()
    }
    if (!driveLetter) {
        console.log(`Not remained drive: ${driveLetter}`);
        return null
    }
    let { hostname, pathname } = this.parseShareDirHostAndPath(url)

    const cmd = `net use ${driveLetter} ${hostname} ${pwd} /user:${usr}`;
    try {
        execSync(cmd);
        this.saveUserData(networkDriveLetter, driveLetter)
        return driveLetter
    } catch (error) {
        console.log(`Error mapping drive: ${error.message}`);
        return null
    }
}

parseShareDirHostAndPath(host) {
    host = host.replace(/^[\/\\]+|[\/\\]+$/g, '');
    const pathParts = host.split(/[\/\\]+/);
    const hostname = `\\\\` + pathParts.slice(0, 2).join('\\');
    let pathname = pathParts.slice(2).join('\\');
    pathname = pathname.replace(/^[\/\\]+|[\/\\]+$/g, '');
    return {
        hostname, pathname
    }
}

getShareStringUserPassword(input) {
    let url = input.split(/[a-zA-Z0-9]+\:[a-zA-Z0-9]+/)[0]
    url = url.replace(/\/+$/, '');
    let match = /[a-zA-Z0-9]+\:[a-zA-Z0-9]+/.exec(input);
    let usr = ``, pwd = ``
    if (match) {
        match = match[0]
        match = match.split(':')
        usr = match[0]
        if (match.length > 1) {
            pwd = match[1]
        }
    }
    let result = {
        url,
        usr,
        pwd
    };
    return result
}

scanNetworkDirectorySync(hoststr, dir) {
    let driveLetter = this.mapNetworkDriveSync(hoststr)
    if (!driveLetter) {
        console.log(`Error scanning drive: ${driveLetter}`);
        return null
    }
    try {
        return fs.readdirSync(path.join(driveLetter, dir));
    } catch (err) {
        console.log(`Error scanning directory: ${err.message}`);
        return null
    }
}
openNetworkFile(hoststr, fp) {
    let { url, usr, pwd } = this.getShareStringUserPassword(hoststr)
    let { hostname, pathname } = this.parseShareDirHostAndPath(url)
    let driveLetter = this.mapNetworkDriveSync(hoststr)
    let network_map_localdir = path.join(driveLetter, pathname)
    fp = path.join(network_map_localdir, fp)
    if (fs.existsSync(fp)) {
        return this.readFile(fp)
    }
    return ``
}
getNetworkPath(hoststr, fp) {
    let { url, usr, pwd } = this.getShareStringUserPassword(hoststr)
    let { hostname, pathname } = this.parseShareDirHostAndPath(url)
    let driveLetter = this.mapNetworkDriveSync(hoststr)
    let network_map_localdir = path.join(driveLetter, pathname)
    if (fp) network_map_localdir = path.join(network_map_localdir, fp)
    return network_map_localdir
}
openNetworkJSON(hoststr, fp) {
    fp = this.openNetworkFile(hoststr, fp)
    try {
        fp = JSON.parse(fp)
    } catch (e) {
        fp = {}
    }
    return fp
}