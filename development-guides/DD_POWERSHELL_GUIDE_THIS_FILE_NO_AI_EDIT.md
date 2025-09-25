<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# DD PowerShell 开发规范 - Windows

## 项目根目录声明

RootDir: `../`（相对于本文档）  
本文档中的所有路径均以 `$RootDir/` 作为基准。


### 1. 双层启动架构（dd.cmd → dd.ps1）

DD PowerShell 由 `$RootDir/dd.cmd` 引入 `scripts/shells/win/dd.ps1` 其中主要功能在dd.ps1,同名cmd仅是入口文件

### 3. 共公规范

- **禁止与Liunx脚本区混淆**：`scripts\shells\debian`，同时sh脚本和ps脚本进行脚本区别不能互相引用
- **开发中禁止运行测试命令、书写测试代码**
- **禁止AI写总结**
- **代码全英文，只能包含ASCII码**
- **每个脚本都要先定义自身位置，然后查找相对位置尝试找到 `$RootDir`**


**dd.cmd 设置思想**
- 其中定义了本项目的远程仓库地址，并有一个本地用户数据目录(标识为`local_user_dir`)的基准目录，以及一个项目的本地开发目录。为了能让本脚本能在其他位置轻量运行，当复制dd.cmd运行时，会自动从仓库下载远程安装脚本`scripts\shells\win\main_powershells\WinScriptsInstaller.ps1`，安装脚本进一步处理复杂的下载，将本项目的dd.cmd/ps1的环境部署下载下来，而在是在开发环境运行时，为了测试最新脚本，则智能使用开发目录

**scripts/shells/win/dd.ps1 构架**
- dd.ps1是主执行文件，先标识 dd_ps1_current_dir 为脚本所在目录，标识 `core_node_dir` 开发目录，为 dd.ps1 会智能检测core_node_dir并对其中几个重要目录 `("apps", "ncore", "scripts")`进行深度处理（比如修正编码）
- 环境测试开发指导，dd.ps1同时会引入 `dd_ps1_current_dir/main_powershells/EnvironmentDetection.sh` 检测本机环境情况(如JAVA)，如有新的环境开发要求添加至此部份
- 主菜单开发指导，dd.ps1 会显示一个主菜单，可以 上下选择 menu-item, 左右可以在选中菜单上 toggle 可选项(如果此菜单有)，如有新的菜单发要求扩展原有代码逻辑


**dd.sh主要功能1：安装 & 测试环境部署脚本 构架及规范、安装环境部署脚本添加流程，当需要添加环境部署脚本时 指导**
- 该功能位于dd.sh菜单项中，选择中菜单会显示二级菜单，二级菜单1：安装脚本，二级菜单2：测试脚本。安装会自动调用`dd_ps1_current_dir/menu_itemshells/DevInstaller.ps1` 并智能使用 `local_user_dir` 或 `core_node_dir` 作基准目录，并智能选择下载远程仓库或执行 `dd_ps1_current_dir/install_powershells` 中的脚本，以`Step{Index}`为作前缀的脚本进行环境部署，注意这些脚本名将硬编码在 `DevInstaller.ps1` 中，这样做的目的是在轻量级运行时能准确知道下载那些文件。测试 则自动调用`dd_ps1_current_dir/menu_itemshells/TestInstaller.ps1` 并显示硬编码的`Step{Index}`，输入编号后会自动匹配对应的脚本执行测试。`TestInstaller.ps1` 和 `DevInstaller.ps1`  将共同引用一个 硬编码所有 `Step{Index}`的文件 `dd_ps1_current_dir/main_powershells/InstallerScriptsList.ps1` ，这样是为了所有脚本只硬编码一次。
- 环境部署脚本开发规范 ：`dd_ps1_current_dir/install_powershells` 其中放置以 `Step{Index}` 环境安装脚本，并根据index有依赖关系，比如安装yarn时应该有更小的index安装node.每个脚本都要按照`"$PSScriptRoot\..\win_common\GlobalVars.ps1" "$PSScriptRoot\..\win_common\CommanFunc.ps1"/"$PSScriptRoot\..\win_common\WindowsPathFunction.ps1"` 该相对路径引入全局变量、共公函数、全局变量设置器，其中`GlobalVars.ps1`存放会局变量例如默认安装目录/默认安装包等信息，开发时要将全局变量添加至此文件，同时也要优先引用`GlobalVars.ps1`。 `CommanFunc.ps1` 为全局共公函数：快捷方式/文件下载/解压等功能/打印方法 等需要优先调用。`WindowsPathFunction.ps1` 用于设置Windows Path/ Var变量等，比如添加Path、设置JAVA_HOME等，任何环境部署后都要尽可能设置到全局环境变量。任何部署脚本都在内部命名一个变量 ：脚本Index，并在打印的时候作为前缀，便于测试时知道是那一个脚本的输出。 同时 代码全英文，只能出现ASCII字符表，同时要遵守：脚本反复运行能 恢复/修正/安装指定的包、修复将有独立分支，无法是否安装都独立修复，编程环境、必要库工具必须修复PATH环境、VAR环境(比如JAVA_HOME) - 同时主流环境需要与 `dd_ps1_current_dir/main_powershells/EnvironmentDetection.ps1` 联动， 同时安装优先使用`Winget`且优先调用`CommanFunc.ps1`中的winget执行方法并传递正确参数/ 其次为基于基本`Step{Index}` 安装后的`choco` 等工具、最后为web下载包解压、以及官方文档指导
- 不同脚本间变量交换使用`GlobalVars.ps1 -> Set-GlobalVar $key $val/Get-GlobalVar $key $defaultVal` 进行交换，GlobalVar会使用一个用户目录下的变量文件区使用文件更改的形式进行变量值交换 （Get-GlobalVar可以传递默认值）。
- `dd.ps1`将设置两个重要的变量`SELECTED_REGION` 可选值: "China"<只有当china时才设置mirror、源等>, "Global"<Global默认不操作、使用默认源> / `INSTALL_TYPE` 可选值:"base"<基础软件都要安装、但服务器类比如mysql不装>, "server"<基本软件和服务器类都装,但应用软件如vscode类不装>, "full"<全部尝试安装>  , 这些变量使用 Get-GlobalVar 在其他脚本中获取，用于在安装时是否设置必要mirror、环境等的判断条件。不要依赖于脚本传入而是使用Get-GlobalVar获取
- 当需要添加环境/app部署脚本时，先根据是否是环境(如Java) [如果是多版本添加list到 GlobalVars.ps1]、基础包(如Ffmpage) :追加至 GlobalVars.ps1 $Global:BasePackages 对角、然后再在`Step{Index}`脚本中统一引用 - 其目的就是对包的名称/特性/安装方式等在GlobalVars中集中管理、**$Global:BasePackages 中的所有基础包都通过 Step<SetpIndex>_InstallBasePackages.ps1 进行集中安装**、必备基础软件(如chrome) 追加到 GlobalVars.ps1 $Global:$APPLICATIONS_PACKAGES 对象、非必备开发软件(如Termius) 追加到 $Global:$DEV_SOFTWARE_PACKAGES，如果现有的数据对角不满足，则在item上扩展出必要的信息如安装方式(如winget/web下载/choco等)/是否加入环境变量等，之后分析其依赖层级出一个合适的 `Step{Index}`及脚本名，引入GlobalVars.ps1、并按本文档的前述规范进行开发脚本，调用`GlobalVars.ps1`/`CommanFunc.ps1`完成功能开发，分析是否调用`WindowsPathFunction.ps1` 设置必要的参数(如java除了添加Path还要设置JAVA_HOME)，符合反复运行具备:恢复、修复、安装的原则，对于安装的测试优先使用二进制文件的判断（不要使用winget、npm等来判断，因为判断很慢）,硬编码脚本名至`WindowsPathFunction.ps1` ,分析环境是否最主流是否要与`dd_ps1_current_dir/main_powershells/EnvironmentDetection.ps1`联动。最检测添加的环境是否在`dd.sh`主菜单中的设置项，比如`install xxx enable?`,是否需要`GlobalVars.ps1 -> Set-GlobalVar $key $val/Get-GlobalVar $key`交换变量。使用Get-GlobalVar获取`SELECTED_REGION` 可选值: "China"<只有当china时才设置mirror、源等>, "Global"<Global默认不操作、使用默认源> / `INSTALL_TYPE` 可选值:"base"<基础软件都要安装、但服务器类比如mysql不装>, "server"<基本软件和服务器类都装,但应用软件如vscode类不装>, "full"<全部尝试安装> 用于环境在需要时设置mirror/url/源的判断依据。
- 对于规范里提到的文件，你都要实地读取遍，了解实际功能、逻辑、参数，而不能随意调用、报错后又重修-浪费你的算力.

**dd.sh 安装器 `dd_ps1_current_dir/main_powershells/WinScriptsInstaller.ps1` 开发规范**
- 本规范基于之前的公共规范,`dd_ps1_current_dir/main_powershells/WinScriptsInstaller.ps1` 会基于脚本所在目录，得到 `dd_ps1_current_dir` 并从远程 仓库下载必要的文件到一个轻量运行的平台，该轻量运行的平台可能不包含本项目的代码，而是依赖于`dd.cmd -> dd.ps1`到软件仓库下载，开发时需要从`dd.ps1`推荐，将必要的文件添加到`WinScriptsInstaller.ps1`并确保其以$LocalDataDir 为基准，将远程文件下载并对path（也即时相对远程基准URL后的相对路径）在本地同样被创建。
- `WinScriptsInstaller.ps1` 运行必要的依赖文件由 `$RootDir/dd.cmd`(注意是CMD)负责下载，当有新的基础包被添加时，要查看`dd.cmd`。而   `WinScriptsInstaller.ps1` 负责`scripts/shells/win/dd.ps1` 被正确下载包含依赖包，最后由 `dd.cmd` 在 `WinScriptsInstaller.ps1`完成后引用`scripts/shells/win/dd.ps1`。但`dd_ps1_current_dir/install_powershells`中的安装脚本的下载由`DevInstaller.ps1`处理，这是为了保证 `WinScriptsInstaller.ps1`只处理最轻量的运行，当涉及要安装环境时再由`DevInstaller.ps1` 去下载每个安装脚本.

**dd.sh 环境部署脚本执行器 `dd_ps1_current_dir/DevInstaller.ps1` 开发规范**
- 本规范基于之前的公共规范,`dd_ps1_current_dir/DevInstaller.ps1` 会基于 `dd_ps1_current_dir/main_powershells/InstallerScriptsList.ps1`  智能判断是轻量级运行 下载`dd_ps1_current_dir/install_powershells` 其中的脚本(也即是所有  `Step{Index}`脚本)，或者可以直接在开发代码上运行。注意当运行 DevInstaller.ps1 时要确保 如果是轻量环境量 `WinScriptsInstaller.ps1`已经将必要基础脚本的结构无错的存放在轻量用户目录中


### 3. 禁止事件

- **禁止与Liunx脚本区混淆**：`scripts\shells\debian`
- **开发中禁止运行测试命令、书写测试代码**
- **禁止AI写总结**

# `dd.cmd -> dd.ps1` 开发规范检测清单（Windows/PowerShell）

静态报告生成要求：请基于本清单生成静态报告文件（固定路径，不可更改）：`$ProjectRootDir\.compliance\DD_POWERSHELL_COMPLIANCE_REPORT.md`

说明：本清单用于对 `dd.cmd → scripts/shells/win/dd.ps1` 架构及其相关安装器与安装脚本生态进行“反问式”合规性自检。请逐项回答“是/否/不适用”，并对“否”项给出整改要点。

## 基础与目录/入口
-  是否在每个 PowerShell 脚本开头都能通过 `$PSScriptRoot` 及父级目录回溯定位到 `$RootDir`？
-  是否严格遵循双层启动架构：由 `$RootDir/dd.cmd` 引入并执行 `scripts\shells\win\dd.ps1`，且不在 `dd.cmd` 中编写业务逻辑？
-  `dd.cmd` 是否实现“本地优先 + 远程回退”的引导策略（本地存在 `dd.ps1` 则直接执行，否则下载安装器并再执行 `dd.ps1`）？
-  `dd.cmd` 是否固定从远程仓库 `https://gitee.com/accountbelongstox/core_node/raw/main` 下载 `scripts/shells/win/main_powershells/WinScriptsInstaller.ps1`？
-  `dd.cmd` 是否始终记录并在结束时恢复原工作目录，最后执行 `endlocal`？
-  所有由 `dd.cmd` 启动的 PowerShell 调用是否使用 `-NoProfile -ExecutionPolicy Bypass` 以避免用户环境干扰？
-  `dd.cmd` 的下载安装是否非交互、失败即停止并清晰输出错误码/信息？
-  是否严格区分 Windows/PowerShell 与 Linux/Shell 的脚本区，未从 PowerShell 侧引用 `scripts\shells\debian`？
-  如果复制 `dd.cmd` 到任意路径轻量运行，是否依旧能正确下载安装器并拉起 `dd.ps1`？
-  如果需要修改远程仓库地址或安装器相对路径，是否同步更新 `dd.cmd` 中的常量与参数并验证两种路径（本地/远程）均可用？

## 编码与合规
-  所有脚本是否仅使用 ASCII 字符、英文注释与英文标识符？
-  是否未编写或执行任何“测试代码/测试命令”？
-  是否未创建或修改任何非必要文档（如 README.md）？
-  输出日志是否简洁、无敏感信息泄露？
-  如果代码中存在中文或非 ASCII 内容，是否已替换为英文与 ASCII？

## dd.cmd 设置思想与本地/远程约定
-  是否定义本地用户数据根目录为 `%USERPROFILE%\\.core_node\\` 并用于轻量运行时的缓存/下载？
-  是否优先执行本地 `scripts\\shells\\win\\dd.ps1`，缺失时才下载安装器？
-  安装器的下载输出目录结构是否与远程路径保持一致（相对路径一一对应）？
-  调用安装器时是否传递 `-LocalDataDir` 与 `-RepoBaseUrl` 参数且值正确？
-  安装器执行后，是否验证 `%USERPROFILE%\\.core_node\\scripts\\shells\\win\\dd.ps1` 存在并执行？
-  如果下载失败（`Invoke-WebRequest` 报错），是否中止后续流程并打印错误？
-  如果安装器新增“轻量运行必需依赖”，是否确保 `dd.cmd` 能够获取并触达这些文件？

## dd.ps1 架构与职责
-  是否通过 `$PSScriptRoot` 正确定位脚本目录并推导 `CORE_NODE_DIR`（含开发目录与默认目录回退）？
-  是否对关键目录 `apps`、`ncore`、`scripts` 做必要处理（如脚本解锁、行尾修正）且失败不影响整体？
-  是否尝试加载 `scripts\\shells\\win\\main_powershells\\EnvironmentDetection.ps1` 并在缺失时优雅降级？
-  是否提供交互菜单（上下移动、左右切换、回车执行）并使用全局变量文件持久化每项当前值？
-  是否创建/确保 `%USERPROFILE%\\.core_node\\global_var` 目录存在并使用 UTF-8 无 BOM 读写键值文件？
-  是否支持 `Set-GlobalVar`/`Get-GlobalVar` 的最小健壮性（移除空字节、自动建目录）？
-  是否创建 `"%ProgramFiles%\\dd.ps1"` 的符号链接指向当前脚本，且在冲突时自动修正？
-  是否进行管理员权限检查，不满足则退出并提示？
-  是否将系统/软件检测结果缓存到 `%USERPROFILE%\\.core_node\\cache` 下（如适用）？
-  如果 `EnvironmentDetection.ps1` 缺失，是否打印提示并跳过环境检测而不是抛出？
-  如果新增菜单项，是否支持左右切换值并即时持久化保存？

## 主要功能1：安装与测试环境部署
-  选择安装时是否优先执行本地 `DevInstaller.ps1`，缺失则从远程下载到 `INSTALLER_SCRIPTS_DIR` 并执行？
-  是否使用统一清单 `InstallerScriptsList.ps1` 维护 `Step{Index}` 的脚本名（单一来源，避免多处硬编码），同时文件路径、相对路径处理是否符合规范且正确？
-  `DevInstaller.ps1`/`TestInstaller.ps1` 是否以 `local_user_dir` 或 `core_node_dir` 为基准并按顺序执行步骤脚本？
-  安装顺序是否遵循依赖关系（如 Node 在 Yarn 前）？
-  如果新增环境部署脚本，是否已：引入 `win_common/GlobalVars.ps1`、`CommanFunc.ps1`、`WindowsPathFunction.ps1` 并设置脚本 Index？
-  如果新增环境部署脚本，是否具备“恢复/修复/安装”的幂等逻辑，优先用二进制存在性检测而非包管理器查询？
-  安装完成后是否尽可能设置 PATH/JAVA_HOME 等全局环境变量（经 `WindowsPathFunction.ps1`）？
-  主流环境是否与 `EnvironmentDetection.ps1` 的检测展示联动？
-  选择“测试脚本”时是否显示 `Step{Index}` 清单并按输入编号匹配执行？

## 主要功能2：添加环境/应用部署脚本的流程
-  新增脚本是否按类型归档：环境（多版本登记于 `GlobalVars.ps1`）、基础包（`BasePackages`）、必备应用（`APPLICATIONS_PACKAGES`）、开发软件（`DEV_SOFTWARE_PACKAGES`）？
-  新增脚本是否分析依赖并分配合适的 `Step{Index}` 与脚本名？
-  是否优先使用 Winget（经 `CommanFunc.ps1` 封装）；其次 Choco；最后 Web 下载/解压与官方文档？
-  安装后是否尽可能写入/刷新全局环境变量并更新 PATH？
-  如果采用 Web 下载/解压，是否下载到约定目录、校验完整性（可选）、处理解压与可执行权限、并打印可复制的使用提示？
-  是否使用Get-GlobalVar获取`SELECTED_REGION` 可选值: "China", "Global" / `INSTALL_TYPE` 可选值:"base", "server", "full" 用于环境在需要时设置mirror/url/源的判断依据。

## 安装器（WinScriptsInstaller.ps1）协作规范
-  是否仅由 `dd.cmd` 负责下载安装器本体，安装器再去下载其余依赖文件？
-  安装器下载是否以 `$LocalDataDir` 为根并保持远程相对路径结构一致？
-  安装器结束后是否保证 `scripts\\shells\\win\\dd.ps1` 与依赖完整，从而可被 `dd.cmd` 后续执行？
-  如果新增“轻量运行必需”文件，是否将其列入安装器下载清单并验证引导仍可用？
-  如果调整安装器参数命名或新增参数，是否同步更新 `dd.cmd` 的传参并进行双路径验证？

##  敏感信息加密系统（497字符）：
- 基于git push前加密机制，保护API密钥等敏感信息。使用AES-256加密，双密码确认，命名空间隔离。未加密文件存.secrets/raw/（gitignore屏蔽），加密文件存.secrets/encrypted_c
ore_node/（提交到git）。开发环境直接读取未加密文件，Git提交前自动检测并要求加密，GlobalVars.ps1支持加密密钥读取提示输入密码解密，新环境clone后自动检测加密文件并提示
解密。dd.ps1和GlobalVars.ps1独立实现相同加密逻辑，预置ALIBABA_CLOUD_ACCESS_KEY_ID等示例密钥。密码仅存内存不记录文件，会话级缓存重启后需重新解密，项目命名空间隔离支
持多项目共存。

这个描述涵盖了：
- 核心机制（git push前加密）
- 技术特性（AES-256，双密码确认）
- 目录结构（raw/encrypted分离）
- 功能流程（开发→加密→提交→clone→解密）
- 安全保障（内存密码，会话缓存，命名空间隔离）