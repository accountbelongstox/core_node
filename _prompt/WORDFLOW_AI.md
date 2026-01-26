capacitor 查看官方文档,调用MCP,1:加入解决页面顶部在编译后没有留空的问题,2
:使用capacitor的一些高级功能,比如      "@capacitor/action-sheet": "^8.0.0",
    "@capacitor/android": "^8.0.0",
    "@capacitor/app": "^8.0.0",
    "@capacitor/app-launcher": "^8.0.0",
    "@capacitor/assets": "^3.0.5",
    "@capacitor/browser": "^8.0.0",
    "@capacitor/camera": "^8.0.0",
    "@capacitor/cli": "^8.0.0",
    "@capacitor/clipboard": "^8.0.0",
    "@capacitor/core": "^8.0.0",
    "@capacitor/device": "^8.0.0",
    "@capacitor/dialog": "^8.0.0",
    "@capacitor/filesystem": "^8.0.0",
    "@capacitor/geolocation": "^8.0.0",
    "@capacitor/haptics": "^8.0.0",
    "@capacitor/ios": "^8.0.0",
    "@capacitor/keyboard": "^8.0.0",
    "@capacitor/local-notifications": "^8.0.0",
    "@capacitor/network": "^8.0.0",
    "@capacitor/preferences": "^8.0.0",
    "@capacitor/share": "^8.0.0",
    "@capacitor/splash-screen": "^8.0.0",
    "@capacitor/status-bar": "^8.0.0",
    "@capacitor/toast": "^8.0.0", 
(注意版本号以最新为准),调用ｐｎｐｍ安装,3:/login 中使用 capacitor的能力,在
ａｐｐ和ｗｅｂ下兼容保存输入过的用户名和密码(登陆成功过的,也就是要登陆成功
后才保存到ｓｔｏｒａｇｅ),注意第一步都要调用ｍｃｐ,查看官方文档,要有修改依
据. 

查看capacitor官方的storage组件,如何兼容性的使用,之之后修改本项目的storage
,使用兼容方式,并使用中心化的存储和状态中心,对于登陆状态,登陆成功的账号密码
保存(登陆成功后,如果退出下次再登陆时账号密码会直接填在输入框). 

后端完全使用laravel能力,不会的调用MCP查看官方文档,不要写一堆php代码. > 不要定义一大堆  connection key,使用统一的数据中心. 继续查看其他其他,直到你找不到没有使用laravel能力的代码. 
注意每改一处都查看查关联代码,先全面考虑并使用最优逻辑,禁止只改一处而不考
虑其他地方. 

php artisan sys:init全量处理所有问题,并具有ming等性,如果表存在则跳过,不存在创建,存在但字段不一样则修正(但不能删除其中的数据),全部使用laravel的能力.

# 测试单词
php artisan appqyv1:test-tts "hello" --lang=en --type=word

# 测试句子
php artisan appqyv1:test-tts "Hello world" --lang=en --type=sentence

# 中文测试
php artisan appqyv1:test-tts "你好" --lang=zh --type=word