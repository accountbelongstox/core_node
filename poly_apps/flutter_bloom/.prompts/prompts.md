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