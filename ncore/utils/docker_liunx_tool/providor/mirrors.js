class DockerMirrors {
    getMirrors() {
        return [
            "https://hub.uuuadc.top",
            "https://docker.anyhub.us.kg",
            "https://dockerhub.jobcher.com",
            "https://dockerhub.icu",
            "https://docker.ckyl.me",
            "https://docker.awsl9527.cn",
            "https://4idglt5r.mirror.aliyuncs.com",
            "https://registry-1.docker.io",
            "https://gcr.io",
            "https://asia.gcr.io",
            "https://azurecr.io",
            "https://quay.io",
            "https://docker.m.daocloud.io",
            "https://hub-mirror.c.163.com",
            "https://dockerproxy.com",
            "https://mirror.baidubce.com",
            "https://docker.nju.edu.cn",
            "https://docker.mirrors.sjtug.sjtu.edu.cn"
        ];
    }
}

const dockerMirrors = new DockerMirrors();
export const getMirrors = () => dockerMirrors.getMirrors();
