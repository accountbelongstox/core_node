# 客户端密钥与设备身份：现状与目标设计

日期：2026-10-01
状态：方案（本文档未改动任何代码）
相关文档：`docs_fix/REQUIREMENTS_20260927_CLIENT_KEY_AUTH_AUDIT_FIX.md`（D1：机器调用方使用 dd.sh / dd.cmd 解密安装的共享密钥库中的密钥认证）、
`docs_fix/DESIGN_20260814_QUEUE_CENTER_MACHINE_AUTHENTICATION.md`、
`docs_fix/TODO_20261001_PYCORE_LAN_PHONE_ACCESS.md`、
`config/service_contract.json#client_key_auth`。

## 1. 用户要求

- （原文）"4. 密钥：Laravel、pycore、wordnew 三端用的 CORE_NODE_CLIENT_KEY_1 必须一致。这个密钥还有更好的方案吗，搜索最前沿的方案并告诉我。"
  - 找出比"三端共用一把密钥"更好的方案，依据当前的标准。
- （原文）"先写到docs fix，然后以上能用得到本系统中现在的密钥吗，比如git ssh中的，如果没有合适的密钥，如何让密钥随代码走，并在使用时通过dd cmd sh的解密层使用固定密码（只有我知道的密码）解密并放在不随git走的目录，或者有更好的方案。同时有初始化方法吗，比如上面的密钥都没有时，可以通过系统先初始化一份。搜索文档并更新docs fix"
  - 方案写到这里。
  - 现有密钥（如 git 的 SSH 密钥）能否复用。
  - 否则密钥加密后随代码走，由 dd.cmd / dd.sh 的解密层用只有用户知道的密码解密，放到不随 git 的目录；或者更好的方案。
  - 没有任何密钥时的初始化方法。

## 2. 现状（已在代码中核实）

| 部分 | 位置 | 作用 |
|---|---|---|
| 请求签名（K3） | `pycore/pyutils/common/client_key_auth.py`、`core/integrations/laravel/ClientKeySigner.ts`、Laravel `client.key` 中间件 | 对规范化请求（方法、路径、内容摘要、时间戳、一次性随机数、机器 ID）做 HMAC；密钥 ID 为密钥 sha256 的前若干位；有时钟偏差和随机数有效期，防重放；密钥槽位 `CORE_NODE_CLIENT_KEY_1..5`，用于轮换 |
| 密钥 | `CORE_NODE_CLIENT_KEY_1` | Laravel、所有 pycore、wordnew 共用的**同一把**对称密钥 |
| 随代码走的密钥 | `.secret_keys/already_encrypted/*.js`（随 git）→ `.secret_keys/.secret_ignore/`（被 git 忽略，权限 0600） | `scripts/encryption_tools/secret_crypto.js`：AES-256-GCM。密钥由密码经 PBKDF2-SHA512 推导两轮（100 万次 + 50 万次）并加一段固定附加值。一个进程批量解密；密码错误时不写入任何文件。密码只经标准输入传给工具（`secret_password_runner.js`），不出现在命令行。 |
| dd 解密层 | `scripts/shells/linux/common/secret_tool_common.sh`、`client_key_common.sh`、`scripts/shells/win/win_common/SecretManager.ps1`、`pycore/pyfoundations/secret_manager.py` | dd.sh / dd.cmd 问一次密码，解密到 `.secret_ignore`。`password_mismatch.list` 记录用其他密码加密的密钥，dd 会用主密码重新加密它们。 |
| 初始化 | Linux `client_key_generate_if_absent`（client_key_common.sh）；Windows `Initialize-ClientKeySecret`（SecretManager.ps1）；pycore `_handle_client_key_wrong_password` | 原始文件、加密副本、打包副本都不存在时：生成新的随机密钥，dd 随后提示加密。密钥解不开时：提示重新生成、加密并替换（其他机器随后同步）。 |
| 现有 SSH 密钥 | 各机器上的 `~/.ssh/id_ed25519`（及 `.pub`） | 用于 git 的 Ed25519 密钥 |

也就是说，用户要求的机制——密钥加密后随代码走、dd 用只有用户知道的密码解密到不随 git 的目录、没有密钥时自动初始化——**已经存在，而且做法规范**。

## 3. 发现的问题

1. **共享密钥被编译进 App 包。** `vite.config.ts` 在开启该选项的构建中定义 `__CORE_NODE_CLIENT_KEY__`（`compiledClientKey`），`ClientKeySigner.ts` 用它签名。任何人解开 APK 就拿到所有端都信任的那把密钥，可以冒充任意一端，包括服务器之间的调用。这是最大的风险。
2. **一把对称密钥用于一切。** 能验证的一方就能伪造；任何一处泄露就全线失守；无法单独吊销某台手机或机器；轮换必须所有端同时换。
3. **所有机器上的所有密钥只靠一个人工密码。** 每台机器都要输入；换密码要重新加密全部密钥；无法把某台机器排除在后续密钥之外。

## 4. 目标设计

### 4.1 手机 / App：安全硬件中的设备密钥（取代编译进包的密钥）

- 首次运行：App 在 Android Keystore（TEE，有条件时用 StrongBox 安全芯片）中生成 Ed25519 / P-256 密钥对，私钥永远不出硬件。iOS 对应 Secure Enclave。
- 一次性登记：Laravel 下发挑战值，App 回传 Android 密钥证明（证明该密钥位于安全硬件中的证书链）。授权方式二选一：
  - 已登录的用户；
  - pycore 界面显示的配对码（即 TODO_20261001_PYCORE_LAN_PHONE_ACCESS.md 中的配对流程）。

  Laravel 维护设备登记表：公钥、设备、所有者、是否吊销。
- 请求：用设备密钥按 RFC 9421（HTTP Message Signatures）签名。它覆盖的字段与现在 K3 规范化字符串相同，现有的时间戳、随机数、防重放规则可直接沿用。验证方只持有公钥。
- 硬件证明属于"加固层"（已 root 的设备上有被绕过的研究），真正的控制手段是登记表和吊销。

### 4.2 用户会话：DPoP（RFC 9449）

Laravel 发放的访问令牌改为短期令牌并绑定设备密钥。每次请求都附带用该密钥签名的 DPoP 证明，令牌即使被截获，没有私钥也无法使用。

### 4.3 机器之间（Laravel / pycore 主机）：每台机器一把密钥，可复用 SSH

- 每台主机用自己的 Ed25519 密钥按 OpenSSH SSHSIG 格式签名机器调用（`ssh-keygen -Y sign -n core-node-k3`）。验证方对照 Laravel 登记表中的 `allowed_signers` 名单核验（名称 = 机器 ID）。指定的签名标识（namespace）把这些签名和 git 签名区分开。
- 复用现有 SSH 密钥：**不可行**。git 的 `id_ed25519` 本身存在加密密钥库里，由 `27_install_git_ssh.sh` 用密码解密后装到每台机器，所以所有机器是同一把密钥，等同于又一把共享密钥。每台机器必须有自己生成的机器密钥（见 4.6）。
- tailnet 内部：Tailscale 已经用 WireGuard 密钥认证了每台机器。接收方可以用 Tailscale 本地的 WhoIs 接口，按调用方的 tailnet 来源地址查出是哪台机器，再按机器授权。身份请求头（`Tailscale-User-Login`）必须先经 WhoIs 核对才可信任，不能直接采信。
- SPIFFE/SPIRE（短期工作负载证书）是数据中心规模的同类方案，对几台机器来说太重，只作参考。

### 4.4 随代码走的密钥：保留现有密钥库，增加按主机解锁

现有密钥库保持不变：用户的密码依然能解密一切，作为最后手段。

增加：信封加密到每台机器**自己的机器密钥**（4.6 的 `CORE_NODE_MACHINE_KEY`，Ed25519 转换为 X25519 后作为 age 接收方，即 SOPS + age 的模式）。不能用 git 的 SSH 密钥，因为它是所有机器共用的同一把（见 4.3）。密钥库的数据密钥（或密码本身）为每台已登记机器的公钥各加密一份，存为 `.secret_keys/hosts/<机器>.age`，随 git 走。

dd.sh / dd.cmd 先尝试用本机机器私钥解锁（不提示），失败才回退到输入密码。效果：
- **已登记的机器不用再输密码。**
- **排除某台机器：** 重新包装数据密钥时不再包含它。
- **更换密码：** 只需重新包装数据密钥，各密钥文件不用重新加密。

机器私钥永远不进 git，进 git 的只有公钥和密文。

### 4.5 初始化（没有任何密钥时）

| 密钥 | 已有 | 需要补充 |
|---|---|---|
| 共享客户端密钥 | 缺失时由 dd 生成；密码丢失时可重新生成并重新加密 | 过渡期保持不变，之后只用于服务器之间 |
| 机器密钥 | - | dd：缺失时生成 `core_node_machine_ed25519`，打印公钥，登记到 Laravel 登记表（管理员批准，或由已登记的机器签名担保） |
| 设备密钥 | - | App 首次运行时生成；通过登录或配对码登记 |
| 主机解锁文件 | - | dd：用密码解密成功后，提示为本机 SSH 密钥包装一份数据密钥 |
| 第一台主机（全新系统） | 密码库 + 生成的客户端密钥 | 第一台机器在本地控制台自行登记为所有者，之后由它签名担保其他机器的登记 |

### 4.6 在本系统中的实现：密码保护的根密钥 + 各自生成的实体密钥

前沿方案与"密钥加密后随代码走、用只有用户知道的密码解密"并不冲突，二者分工如下：**密码只保护一把"所有者根密钥"，它随代码走；每台机器、每台手机的私钥各自本地生成、不随代码走；根密钥给它们签发证书。**

| 材料 | 存放 | 是否随 git | 由谁保护 |
|---|---|---|---|
| 所有者根密钥（Ed25519，私钥） | `.secret_keys/already_encrypted/CORE_NODE_OWNER_ROOT_1.js` | 随 git（加密） | 只有用户知道的密码（现有 secret_crypto.js：AES-256-GCM、PBKDF2） |
| 根公钥（信任锚） | `config/trust/owner_root.pub` | 随 git（明文） | 公开即可，各端只认它 |
| 机器私钥（Ed25519） | `.secret_keys/.secret_ignore/CORE_NODE_MACHINE_KEY`（0600，被 git 忽略） | 不随 git | 本机文件权限 |
| 机器证书 | `.secret_keys/machine.cert`（不随 git）并登记到 Laravel | 不随 git | 根密钥签名，本身可公开 |
| 手机私钥 | Android Keystore / StrongBox | 永不导出 | 安全硬件 |
| 手机证书 / 登记 | Laravel 设备登记表 | - | 所有者批准（登录或配对码） |
| 吊销列表 | Laravel（并同步到各 pycore） | - | 根密钥签名的列表 |

证书用最小自定义格式，不依赖 X.509 或 SSH 证书解析，四端都有现成的 Ed25519 实现（PHP 内置 libsodium `sodium_crypto_sign_verify_detached`、Python `cryptography`、浏览器 / Capacitor WebCrypto Ed25519、Android Keystore）：

```
cert = {v, subject: <machine_id | device_id>, kind: machine|device, public_key, roles, not_before, not_after}
sig  = Ed25519(root_private, canonical_json(cert))
```

**初始化（全新系统，没有任何密钥）**——由 dd.sh / dd.cmd 完成：
1. 没有 `CORE_NODE_OWNER_ROOT_1` 的任何副本：提示设置密码（输入两次），生成根密钥对；私钥用该密码加密写入 `already_encrypted/`，公钥写入 `config/trust/owner_root.pub`。根私钥的明文只在内存中，不落盘。
2. 本机没有机器密钥：生成 `CORE_NODE_MACHINE_KEY`；用同一个密码临时解开根私钥，为本机签发证书（有效期例如 1 年），立即丢弃根私钥明文。
3. 提示提交 `already_encrypted/CORE_NODE_OWNER_ROOT_1.js` 和 `config/trust/owner_root.pub`。

**其他机器加入**：拉代码后运行 dd，它生成本机机器密钥，提示输入同一个密码，临时解开根私钥签发本机证书。只有知道密码的人能让机器加入。

**手机加入**：App 在硬件中生成密钥，走 4.1 的登记流程（登录或配对码）。由 Laravel 用所有者批准记录签发设备证书，或由所有者机器签发。

**请求认证**：RFC 9421 签名，`keyid` 指向证书。验证方依次检查：
1. 证书由根公钥签名；
2. 在有效期内；
3. 不在吊销列表中；
4. 证书的 `roles` 允许该操作；
5. 请求签名正确。

不再需要任何共享密钥。

**轮换与吊销**：
- 机器或手机丢失：把它的证书加入吊销列表即可，其他各端不受影响。
- 换密码：只需用新密码重新加密 `CORE_NODE_OWNER_ROOT_1.js`，已签发的证书全部继续有效。
- 根密钥泄露：生成新根、更新 `owner_root.pub`、重签所有证书。这一步比较重，但极少发生。

**与现有代码的衔接**：
- 加解密复用 `secret_crypto.js`、`secret_tool_common.sh`、`SecretManager.ps1`、`secret_manager.py`，只新增一个密钥名。
- 初始化放在现有的 `client_key_generate_if_absent` / `Initialize-ClientKeySecret` 旁边。
- 签名的规范化字段沿用 `client_key_auth` 合同，`protocol_version` 升一级，过渡期新旧并行。
- 共享的 `CORE_NODE_CLIENT_KEY` 先从 App 包移除，所有机器换成证书后下线。

## 5. 迁移顺序

1. 停止把 `CORE_NODE_CLIENT_KEY` 编译进任何 App 包。共享密钥只留在服务器之间；App 在 4.1 落地前使用登录用户的令牌。这是风险最高的一项，且不需要新协议。
2. App 使用设备密钥 + 配对登记 + RFC 9421 签名（4.1），Laravel 设备登记表支持吊销。
3. 用户令牌改为 DPoP 绑定（4.2）。
4. 机器密钥（SSHSIG）和 tailnet WhoIs 授权（4.3）。此后共享密钥只作过渡回退，最终下线。
5. 密钥库的按主机解锁文件（4.4）。

客户端密钥协议带版本号（`protocol_version`），每一步都可以新旧签名并行接受，平滑过渡。

## 6. 参考资料

- RFC 9421 HTTP Message Signatures：https://www.rfc-editor.org/info/rfc9421/
- RFC 9449 OAuth 2.0 DPoP：https://datatracker.ietf.org/doc/html/rfc9449
- Android Keystore：https://developer.android.com/privacy-and-security/keystore
- 硬件密钥库 / 密钥证明：https://source.android.com/docs/security/features/keystore
- Keystore 密钥证明：https://developer.android.com/identity/digital-credentials/credential-issuer/keystore-attestation
- 硬件证明绕过研究：https://blog.quarkslab.com/bypassing-android-hardware-attestation.html
- ssh-keygen -Y sign / allowed_signers：https://man.openbsd.org/ssh-keygen.1
- 用 SSH 密钥签名任意数据：https://www.agwa.name/blog/post/ssh_signatures
- SOPS + age，以 SSH 密钥为接收方：https://tvi.al/commit-your-secrets-to-git-encrypted-with-sops-and-age/ 、https://github.com/mic92/sops-nix
- Tailscale Serve 身份请求头：https://tailscale.com/docs/features/tailscale-serve
- 身份请求头须经 WhoIs 核对：https://github.com/denoland/clawpatrol/issues/316
- SPIFFE / SPIRE：https://www.redhat.com/en/topics/security/spiffe-and-spire
