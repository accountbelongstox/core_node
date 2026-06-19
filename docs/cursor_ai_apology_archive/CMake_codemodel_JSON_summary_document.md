# CMake codemodel JSON summary document 

to use HuTiGong `<content>` (CMake codemodel JSON) JianMing summary . 

## structure 
- ** DingCeng **: configurations ( ShuZu ) , kind ("codemodel") , paths (build, source) , version (major 2, minor 3) . 
- ** Dan item config **: name "debug"; directories (build ".", source ".", jsonFile, minimumCMakeVersion "3.6.0", projectIndex 0) ; projects (name "Project", directoryIndexes [0]) ; targets for KongShuZu . 

## key points 
- paths.build ZhiXiang Flutter project build Xia .cxx/debug/.../armeabi-v7a. 
- paths.source ZhiXiang Flutter tools gradle Jiao this directory . 
- MiaoShu is Dan project , Dan directory debug config , no targets. 

## purpose 
CMake codemodel v2.3 GeShi , use at MiaoShu Flutter/Android YuanSheng debug (armeabi-v7a) GouJian directory and project structure , Gong IDE or GouJianGongJuJieXi . 
