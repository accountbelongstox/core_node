<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

现在，我们来弄清楚双入口的机制，D:\programing\core_node\poly_apps\flutter_bloom\lib\main.dart 和  D:\programing\core_node\poly_apps\flutter_bloom\lib\apps\app_qy\main_app_qy.dart 都引用同一个入口，先来解决第一个问题，main.dart入口进入时，main首页是一个聚合list页、该页显示也所有app的入口并能路由到one_app_index_page（先了解这一但不着急开发），也就是说，而main_app_xx.dart入口时，首页则是该app的one_app_index_page，这样就即能保证首主入口能调试所有app，又能保凍单独app不包含其他app的代码，
实现方案： 不需要通过参数来判断，main.dart等不需要传递参数，因为这样代码里还是包含了其他app.
先来处理settings_controller.dart，你需要按旧的代码  D:\programing\core_node\poly_apps\flutter_bloom\lib\apps\app_example\controller\settings_controller.dart 规则来。
1：建立一个基础的设置，只有 主题模式/语言/等几个少数设置 此处先标记为 base_sets，然后设计一个通用的设置模版，该通用模板设置基于原来的新增加 设置名/可选项/默认值/推荐页面实现方式(比如是select选项/复选框/toggle框等)/可选label文本 等必要信息，这样所有app共用一种标准就能设计出能用的规则。
2: 建立APP的专属设置 此处先标记来 app_sets
3: 建立一个设置的专门类库，拥有shared_preferences等状态管理，此处先标识为 comm_setting ，设计类库可以合并 base_sets / all/one app_sets 
4: 在主入口 引入所有 app的 app_sets 硬编码，通过 runCommonApp传递给 main_common.dart,再由main_common.dart传递给comm_setting，再由comm_setting 将所有  app_sets 与 base_sets合并，这样就得到了一个所有页成都可以用的大设置，其中包含了所能设置项，也就是任何页面调用都不会报错，
5：在 main_app_xx.dart 只引入专门的app_sets，同样硬编码传递。这样就得到了一个app专属的精简版小设置，不包含其他这样。
总结：代码里不要有if 等判断app的项，而是通过主main中硬编码全部app。专属app硬编码本app的方式进行代码隔离。

从D:\programing\core_node\poly_apps\flutter_bloom\lib\common\app\main_common.dart中推导，现在的 D:\programing\core_node\poly_apps\flutter_bloom\lib\util\route_manager.dart 是一个旧的方案，

1， 你先了解一下更在更新后的 D:\programing\core_node\poly_apps\flutter_bloom\lib\common\apps\apps_bootstrap.dart 逻辑，
2， 通过apps_bootstrap 集中式硬编码所有appname的字符串代码，以防止多个文件需要 硬编码以在代码长的时候忘记，在其中导出一个所有app的 传给 main.dart runCommonApp 再传给路由管理器，这样得到一个可供所有APP、页面使用的包含了所有APP路由的路由管理器
3, 通过 main_app_{appname}.dart 中引用app专属并同样通过 runCommonApp 再传给路由管理器，这样得到一个专属APP的路由管理器，不包含其他APP的路由，路由只定义一次在专属APP之下
4，

\\-----------------------------------------------------------------------------------------------------

修正ps1安装的andriod tool-chine 的问题。

D:\programing\core_node\poly_apps\flutter_bloom\debug.txt  显然还有很多问题，但这只是告诉你还有很多问题，并不是让你根据错误不顾及代码的整体性修复，而是要 再检查一下遗漏，你看看api的配置应该如何放到  D:\programing\core_node\poly_apps\flutter_bloom\lib\apps\app_achat 基对应的域名是https://api.si.12gm.com  对应的后端为 D:\programing\core_node\poly_apps\laravel_main\app\Apps\BankV1  后端文档参考 D:\programing\core_node\poly_apps\laravel_main\development-guides\LARAVEL_GUIDE_THIS_FILE_NO_AI_EDIT.md ，总之现在是跨越app的数据一至性开发。D:\programing\core_node\poly_apps\laravel_main\laravel_main_tree.md  目前flutter的后端已经有了，但这个功能中包括登陆等去掉，目前并前端是一个测试APP并不需要 登陆， 只需要 心跳API，以及修改信息后上传到API，以及前端会生成一个毓信息，当然你要先整体查看一下代码，你需要 聚合优化以前的代码，而不是不读取以前的代码就直接开写。同时在fluuter端你要引用 D:\programing\core_node\poly_apps\flutter_bloom\lib\common


For the code present, we get this error:
```
The argument type 'AuthMetadata (where AuthMetadata is defined in D:\programing\core_node\poly_apps\flutter_bloom\lib\common\network\core\network_types.dart)' can't be assigned to the parameter type 'AuthMetadata (where AuthMetadata is defined in D:\programing\core_node\poly_apps\flutter_bloom\lib\common\provider_status\user_provider.dart)'. 
```
How can I resolve this? If you propose a fix, please make it concise.
For the code present, we get this error:
```
The name 'CacheManager' is defined in the libraries 'package:qyflutter/common/cache_manager/cache_manager.dart' and 'package:qyflutter/common/network/core/network_types.dart'.
Try using 'as prefix' for one of the import directives, or hiding the name from all but one of the imports.
```
How can I resolve this? If you propose a fix, please make it concise.

D:\programing\core_node\poly_apps\flutter_bloom\lib\apps\app_example\error.txt 你先查看错误，然后了解一下项目的结构，D:\programing\core_node\poly_apps\flutter_bloom\lib\lib_tree.md 然后进行修复，注意，你能单独的修复一个文件，而是整体分析然后做处调整甚至可以重构，同时你要知道 common目录 是不引用户外部文件、且可以扩展为更通用性。如果你要参考 规范可以查看 D:\programing\core_node\poly_apps\flutter_bloom\development-guides\FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md