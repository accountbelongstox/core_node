# 生成自签名证书
$cert = New-SelfSignedCertificate -CertStoreLocation cert:\LocalMachine\My -DnsName "localhost" -KeyExportPolicy Exportable -KeyLength 2048 -KeyUsage DigitalSignature -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1")

# 将证书导出为 .crt 文件
$cert | Export-Certificate -FilePath "localhost.crt"

# 将私钥导出为 .key 文件
$keyFile = "localhost.key"
$pwd = ConvertTo-SecureString -String "yourpassword" -Force -AsPlainText
$cert | Export-PfxCertificate -FilePath $keyFile -Password $pwd

# 将私钥转为 PEM 格式
$key = [System.IO.File]::ReadAllText($keyFile)
$exportedKey = "-----BEGIN PRIVATE KEY-----`n$key`n-----END PRIVATE KEY-----"
[System.IO.File]::WriteAllText($keyFile, $exportedKey)
