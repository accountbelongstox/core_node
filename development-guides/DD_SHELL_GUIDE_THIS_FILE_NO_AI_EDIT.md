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

# DD Shell 开发规范 - Debian 系统

## 项目根目录声明

**RootDir**: `../` (相对于本文档的位置)  
所有文件路径均以 `$RootDir/` 作为相对路径基准。

## 概述

`dd.sh` 是提供统一的开发环境管理、应用部署和系统配置功能。

## 脚本架构

### 核心组件及对应文件

```
dd.sh
├── 变量声明区域 
├── 交互式菜单 (引用`scripts/shells/`中的脚本)
```

### 目录结构依赖

```
$RootDir/ (CORE_NODE_ROOT_DIR)
├── apps/                           # 与本项目无关(ncore/app 区)
├── ncore/                          # 与本项目无关(ncore 服务区)
├── scripts/                        # 脚本目录
│   ├── shells/                     # dd.sh 调用的Shell 脚本集合
│   │   ├── LGar.sh                 # 全局变量. 放置在顶级目录便于下级文件引用
│   │   ├── common/                 # 通用脚本
│   │   │   ├── gvar_common.sh      # (专门用于变量交换)被dd.sh调用的其他脚本所依赖的全局变量通用函数
│   │   │   └── selector_common.sh  # 被dd.sh调用的其他脚本所依赖的选择器通用函数
│   │   ├── scripts/                # 功能脚本
│   │   │   ├── docker-compose-selector.js  # 被dd.sh调用：Docker Compose 选择器
│   │   │   ├── manage_service.js            # 被dd.sh调用：服务管理脚本
│   │   │   └── ...                          # 被dd.sh调用：其他功能脚本
│   │   ├── debian/                 # 被dd.sh调用：Debian 特定脚本
│   │   │   ├── install.sh          # 被dd.sh调用：主安装脚本
│   │   │   ├── install_shells/     # 被dd.sh调用：安装子脚本目录
│   │   │   └── run_apps/           # 被dd.sh调用：应用运行脚本，分运行(./apps/appNameDir 以及 ./poly_apps/polyAppDir 下的*.sh应用启动脚本)
│   │   │       └── run_app.sh      # 被dd.sh调用：应用运行脚本，分运行(./apps/appNameDir 以及 ./poly_apps/polyAppDir 下的*.sh应用启动脚本)
│   │   ├── docker_compose/         # 被dd.sh调用：Docker Compose 配置
│   │   └── win/                    # 被另一个dd.ps1调用、该区域由文档 `DD_POWERSHELL_ENVIRONMENT_VARIABLE_SUPPORT_SCRIPT.md` 负责解释规范：Windows 脚本
│   │       └── DevInstaller.ps1    #  被另一个dd.ps1调用、该区域由文档 `DD_POWERSHELL_ENVIRONMENT_VARIABLE_SUPPORT_SCRIPT.md` 负责解释规范：Windows 开发环境安装器
│   ├── git/                        # 与本项目无关，该区域由文档 `DD_POWERSHELL_ENVIRONMENT_VARIABLE_SUPPORT_SCRIPT.md` 负责解释规范，Git 相关脚本
│   │   ├── gitpull.sh              # Git 拉取脚本
│   └── ...                         # 与本项目无关，除`scripts/shells`的其他脚本目录，均由`./poly_apps/AUXILIARY_SCRIPTS_DEVELOPMENT_GUIDE.md` 脚本负责解释
├── install/                        # 安装脚本 (已弃用，迁移到 scripts/shells/)
├── dd.sh                           # 主管理脚本
├── dd.cmd                          # 另一个dd.ps1调用、该区域由文档 `DD_POWERSHELL_ENVIRONMENT_VARIABLE_SUPPORT_SCRIPT.md` 负责解释规范：Windows 批处理入口
└── dd.ps1                          # 另一个dd.ps1调用、该区域由文档 `DD_POWERSHELL_ENVIRONMENT_VARIABLE_SUPPORT_SCRIPT.md` 负责解释规范：Windows PowerShell 脚本
```

## 基本开发规范

### 全局变量管理: LGar.sh 引入规范

所有 `install_shells` 脚本都必须优先引入位于 `scripts/shells/LGar.sh` 的全局变量管理文件。此文件放置在 `shells` 顶级目录是为了便于所有下级脚本都能方便地引用。脚本在引用时，需要通过文件自身的位置来动态计算相对路径。此文件负责定义和管理所有脚本共享的全局变量和核心配置。引入方式如下：

```bash
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/LGar.sh"
```

### 1. 不同脚本间变量交互规则，调用专门用于变量交换的 `scripts/shells/common/gvar_common.sh` 中的 `set_var $key $val` 将变量保存到用户目录文件中,使用 `get_var $key` 自动从文件中读取，使用系统文件进行交换。变量使用全大写命名
### 2. 只能使用assci码,代码全英文
### 3. dd.sh不引入任何第三方文件、只能调用第三方文件扩展功能，遵守被dd.sh调用的脚本放到 `scripts/shells/debian`, 全局变量、常量放到 `scripts/shells/LGar.sh`,`gvar_common.sh` (专门用于变量交换)可以被任何第三方文件引入(除dd.sh)、但不能引入任何第三方文件。第三方脚本优先引用 `scripts/shells/LGar.sh` 中的常量、变量。
### 4. dd.sh 中有一个菜单用于扩展功能，限于代码长度菜单功能可以调用 `scripts/shells/debian`, 其中` Install the server ` 为常驻菜单，其会调用 `scripts/shells/common/selector_common.sh` 
### 5. 不要写测试脚本和运行测试命令，不要写文件特别是redeme.md，除非有要求
### 6. 公共函数区:优先引用`scripts/shells/common/common_functions.sh` 公共函数区中的内容，公共函数区中的命名规则：`函数名 + _from_common_functions` 如需要向共公函数区添加函数按此命名规则。

## 菜单选择器专门规范： dd.sh 选择器菜单 `selector_common.sh` 开发规范 
- 菜单显示效果大概类似于：···GLOBAL_VAR_DIR: /mnt/c/Users/MPC/.core_node/global_var
Current Mode: base
--------------------------------------
> Switch Installation Mode (INSTALL_MODE) [base]
  Install Baota Panel (INSTALL_BT) [false]···， 通过外部传入的mode来对下面的项进行预调，mode可以不传。mode是是为了载入缺省值，比如mode = server 会默认安装MYSQL等等，这些值修改后会引用·gvar_common.sh`中的`set_var $key $val` 来保存到用户目录的文件，以便于其他第三方文件通过`get_var $key`读取文件变量来查看变量
- 菜单项使用左右键每对个menu-item的可选值进行切换，每个menu-item的都有一个预设值，但会优先使用`get_var $key`存在的值来代替预设值，当按回车时，将按现有逻辑跳转到下一步 也就是开始跑`scripts\shells\debian\install_shells`中的代码

## 菜单项-安装项专门规范：dd.sh 菜单项 ` Install the server ` 开发规范
- 其中` Install the server ` 为常驻菜单，其会调用 `scripts/shells/common/selector_common.sh` ，随后通过 `scripts\shells\debian\install.sh` 依次调用 `scripts\shells\debian\install_shells` 中的安装功能，完成系统安装。注意，其中有脚本基于 `scripts/shells/common/selector_common.sh` 中设定的文件变量、选择是否执行或跳过
- 只需要着重注意支持debian即可，`scripts\shells\debian\install_shells` 中的每个脚本都需要遵守`indexx_scriptname.sh`的命名格式、index为数字. 开发一个install_shells时需要分析现有的所有脚本，保持前后依赖关系，比如是先安装`node`才能完成安装`npm的脚本`
- 每个`install_shells`脚本都要开文件开头···SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"\nPARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"``` 定位自身位置，以及scriptd dir / root dir等的位置。每个脚本在开头设定一个$SCRIPT_INDEX用来作为脚本内部打印的前缀，以便在脚本运行时知道具体是那个脚本在输出
- 所有脚本需要用到的变量，都要声明在文件头部，并大写
- 所有脚本都要加上$USE_SUDO 来替换sudo,但由于某些系统没有sudo命令，sudo需要引用`scripts/shells/linux/common/gvar_common.sh`中的$USE_SUDO,dd.sh中有此判断、可以忽略。
- `install_shells`中的每个脚本在满足条件的情况下（对某些单一安装比如apt install xxx忽略，因为这项工具由apt完成），推荐有几个元素1:环境命令变量，比如7z，2，安装来源，比如是官网下载解压、apt-get更新，总之你要分析出最终的，3，环境验证，并不是所有安装完成后，都能使用环境命令直接验证的，所以验证过程要合理，比如通过npm安装的可能npm的路径并不在PATH导致无法直接执行验证命令，需要相对查找到node/npm的bin目录并遍历连接其中所有二进制到/usr/loca/bin目录，并+x，4，link到/usr/local/bin检测，要独立在另一个分支验证并确保连接并加了+x权限的代码，保证脚本每次重新运行都能刷新link，4：多环境是使用上面的元素做一个遍历列表，以复用代码
- 优先引用`scripts/shells/linux/common/common_functions.sh` 公共函数区中的内容，公共函数区中的命名规则：`函数名 + _from_common_functions` 如需要向共公函数区添加函数按此命名规则。

## `install_shells` 脚本开发规范 && 菜单项 ` Install the server `所引用脚本 的开发规范
- `install_shells`中的每个脚本在满足条件的情况下，推荐有几个元素1:环境命令变量，比如7z，2，安装来源，比如是官网下载解压、apt-get更新，总之你要分析出最终的，3，环境验证，并不是所有安装完成后，都能使用环境命令直接验证的，所以验证过程要合理，比如通过npm安装的可能npm的路径并不在PATH导致无法直接执行验证命令，需要相对查找到node/npm的bin目录并遍历连接其中所有二进制到/usr/loca/bin目录，并+x，4，link到/usr/local/bin检测，要独立在另一个分支验证并确保连接并加了+x权限的代码，保证脚本每次重新运行都能刷新link，4：多环境是使用上面的元素做一个遍历列表，以复用代码
- **多种安装方式**：apt/yum包管理器、npm全局安装、pipx安装、pip用户安装、官网下载、第三方工具(brew/snap)等
- **满足必要变量和逻辑**：除了单一安装比如apt安装的，尽可能包含全局变量：二进制名（用于检测），安装类型 示例 npm/web下载等，安装属性字段 示例 xxxPackage/packageUrl/webUrl等，期望安装路径 默认为`scripts/shells/LGar.sh` 中导出的 `$COMPILE_DIR/ packageNameDir`, 必要的逻辑：1，是否link正确 并智能修正，2，查找包的原始位置，并确保被移动或已经在  `$COMPILE_DIR/ packageNameDir` 目录，3，验证包是否可用并智能修正，4，独立的验证包可用性,link及修复，无法是否需要安装都单独执行该验证，5，最终验证成功，6，如果包满足，输入使用提示和安装目录等信息的逻辑，
- **权限问题**：软件可能安装在/root目录下，普通用户无法访问 避免依赖root权限，如果一个二进制最终安装位于/root中，先整个目录复制到` `scripts/shells/LGar.sh` 中导出的 `$COMPILE_DIR` 中，但注意要在 `$COMPILE_DIR` 中创建子目录。
-  显示实时输出，提供进度反馈，基于二进制文件检测，不依赖输出信息
- **路径复杂性**：如果使用npm安装，可能二进制不在path中，需要根据npm查找相对的bin目录，并将其中的二进制link到/usr/local/bin，python等同理
1. **符号链接存在性** - 检查链接是否存在 确保文件可执行 验证链接指向正确位置，以解决 ：  命令存在性检查可能返回损坏的链接- 文件存在但可能不可执行 - 有权限但可能指向错误位置 - 版本不匹配或依赖缺失
- **统一目标位置**：所有软件统一链接到`/usr/local/bin` 所有链接必须可执行,支持多种源路径但统一目标路径
- **容错机制**：路径搜索、权限适配、错误恢复
- 状态机流程
```
[初始状态] → [预检测] → [安装决策] → [执行安装] → [后修复] → [最终验证]
```
- 每个阶段的错误不影响其他阶段
- 可以单独重试某个阶段
- **跳过不必要安装**：已正确配置的环境秒级完成
- **精确修复**：只处理有问题的链接
- **并行友好**：独立的检测不会互相干扰
- **智能能判断是否输出一段使用说明** 在脚本最后执行智能判断该软件包如果有必要输出一段使用提示、当然要包含该包的实际位置或link位置，复制其中的代码就能使用和验证

## AI代码合规性检测报告生成指南
**测试目标**: 本文档中的所有规范旨在约束 `dd.sh` 脚本及其直接或间接调用的所有相关脚本（如`common_functions.sh`, `gvar_common.sh`, `selector_common.sh`, `install.sh` 以及 `install_shells` 目录下的所有脚本）的行为。

请根据本开发规范，对上述目标脚本文件进行全面检查，并生成一份名为 `DD_SHELL_DEBIAN_COMPLIANCE_REPORT.md` 的详细检测报告。

**报告生成位置**:
请将报告生成到项目根目录的 `.compliance` 目录中。如果该目录不存在，请创建它。
路径: `$RootDir/.compliance/DD_SHELL_DEBIAN_COMPLIANCE_REPORT.md`

报告应包含以下要点，并对每一项进行明确的“是/否/不适用”的判断，并对“否”项提供简要说明和修改建议：

**1. 文件和项目结构**
*   [ ] **根目录声明**: 脚本是否在开头正确声明了 `RootDir`？
*   [ ] **路径基准**: 所有文件路径是否都正确地以 `$RootDir/` 作为基准？
*   [ ] **脚本位置**: 所有被 `dd.sh` 调用的 Debian 特定脚本是否都放置在 `scripts/shells/linux/debian/` 目录下？
*   [ ] **命名规范 (`install_shells`)**: `install_shells` 目录中的脚本是否都遵循 `indexx_scriptname.sh` 的命名格式？

**2. 通用代码规范**
*   [ ] **ASCII字符集**: 代码中是否只使用了 ASCII 字符？ 
*   [ ] **全英文代码**: 代码和注释中是否全部使用英文？
*   [ ] **变量命名**: 所有变量名是否都为全大写？
*   [ ] **变量交互**: 脚本间的变量交互是否完全通过 `gvar_common.sh` 中的 `set_var` 和 `get_var` 函数进行？
*   [ ] **SUDO使用**: 脚本中是否统一使用 `$USE_SUDO` 变量来执行提权命令？由 `gvar_common.sh`引入。
*   [ ] **文件依赖**:
    *   [ ] `dd.sh` 是否没有直接 `source` 或引入任何第三方文件？
    *   [ ] `gvar_common.sh` 是否没有 `source` 或引入任何其他文件？
*   [ ] **禁止行为**: 是否没有编写测试脚本、运行测试命令或写入非必要文件（如README.md）？

**3. `install_shells` 脚本专门规范** 
*   [ ] **脚本元信息**:
    *   [ ] 每个 `install_shells` 脚本开头是否都正确设置了 `SCRIPT_CURRENT_DIR` 等路径变量？
    *   [ ] 每个脚本是否都在开头设置了 `$SCRIPT_INDEX` 用于日志输出？
*   [ ] **依赖关系**: `install_shells` 中的脚本是否按照正确的依赖关系排序执行？
*   [ ] **变量声明**: 所有脚本中用到的变量是否都在文件头部进行了声明？
*   [ ] **核心元素 - 环境命令变量**: 脚本是否定义了所需的核心命令变量？
*   [ ] **核心元素 - 安装来源**: 脚本是否明确了软件的安装来源？
*   [ ] **核心元素 - 环境验证**: 脚本是否包含了安装后的环境验证步骤？
*   [ ] **核心元素 - 链接与刷新**: 对于需要链接的命令，脚本是否正确地创建并刷新了软链接？
*   [ ] **核心元素 - 多环境支持**: 如果适用，脚本是否通过循环来支持多版本安装？
*   [ ] **脚本实现完整性**: 如果一个脚本能满足的情况下（对某些单一安装比如apt install xxx忽略，因为这项工具由apt完成）：脚本是否完整实现了环境命令定义、安装源、环境验证（含特殊路径处理）、符号链接刷新和多环境支持（如适用）等核心要素？

**4. 菜单与交互 (`selector_common.sh`)**
*   [ ] **模式预调**: 菜单是否能够正确地根据 `mode` 载入缺省值？
*   [ ] **状态保存**: 菜单项的值修改后，是否通过 `set_var` 进行了保存？
