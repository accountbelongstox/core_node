// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

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
