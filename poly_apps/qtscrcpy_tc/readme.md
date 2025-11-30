# 安卓手机投屏、电脑录屏、电脑控制、按键映射、手机群控  

---

|作者|日期|
|---|---|
|将狼才鲸|2021-11-28|

---

## 编译要求  
* 不能直接用最新的Qt（编译会报错，如果用过Qt可以尝试自己解决，只是UTF-8相关的编译报错），我用的是5.15.2 + MSVC2017 64bit  
- 曾经用过最新的版本，Qt6.2.1/Qt6.2.0有multimedia模块的bug，比如QAudioFormat对PCM音频的播放就还不支持，这个bug在Qt6.2.0.alpha中被修正了，但是在正式版中还没发布（2021-11-28）  
- 更新Qt6.1.3时有报错“error during installation process(qt.qt6.613.win64_msvc2019_64):”  
- 安装Qt6.0.4后又发现没有multimedia模块  
- 重新换成了Qt5.15.2版本  
* 源码在QtScrcpy的基础上进行修改和添加  
* 参考：https://gitee.com/Barryda/QtScrcpy/  

## 运行效果  
* 见主目录下的png图片  
![image](./运行效果1.png)  
![image](./运行效果2.png)  

## 发布流程  
* release发布的话还需要用Win10左下方的开始栏中的，qt自带的"Qt 5.15.2 (MSVC 2017 64-bit)"<以自己电脑上安装的版本号为准>工具并用一个qt发布命令生成需要的动态库（可网上搜索流程），并且还需要按原始QtScrcpy文档中的介绍拷贝adb和scrcpy库  
* 参考资料（原QtScrcpy作者的视频教程的最后一章，需要付费观看）：[第八章：跨平台适配-发布](https://edu.csdn.net/learn/10750?spm=1002.2001.3001.4143)  
* 但是步骤也只是先用Qt自带的发布流程发布一遍，然后再将  
qtscrcpy_tc/TcUi/third_party/下的scrcpy-server、  qtscrcpy_tc/TcUi/third_party/ffmpeg/bin/x64\下的\*.dll  
和qtscrcpy_tc/TcUi/third_party/adb/win/下的所有三个adb\*文件都拷贝到Qt发布的文件夹，然后将文件夹打包成rar，再拷贝给别人解压后直接运行文件夹内的exe就行了。  
