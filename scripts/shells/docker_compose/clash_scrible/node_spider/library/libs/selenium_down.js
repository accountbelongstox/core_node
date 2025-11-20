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

async function downloadAndUpload() {
    let url = "$$down_url";
    let uploadUrl = "$$update_url";
    try {
        let response = await fetch(url);
        const blob = await response.blob();
        let contentType = response.headers.get("content-type");
        console.log('download and update',url)
        console.log('content-Type',contentType)//application/octet-stream
        let file = new File([blob], "filename", { type: contentType });
        // 使用另一个fetch将数据发送到另一个URL
        let formData = new FormData();
        formData.append('key', "$$key");
        formData.append('module', 'com_http');
        formData.append('method', 'down_file_from_request');
        formData.append('file', file);
        formData.append('url', url);
        formData.append('file_name', null);
        let uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            body: formData
        });
        return await uploadResponse.json()
    } catch (error) {
        console.error(error);
        return null
    }
}
return await downloadAndUpload();
