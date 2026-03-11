# CMake codemodel JSON 总结文档

对用户提供的 `<content>`（CMake codemodel JSON）的简明总结。

## 结构
- **顶层**：configurations（数组）、kind（"codemodel"）、paths（build、source）、version（major 2, minor 3）。
- **单条配置**：name "debug"；directories（build "."、source "."、jsonFile、minimumCMakeVersion "3.6.0"、projectIndex 0）；projects（name "Project"，directoryIndexes [0]）；targets 为空数组。

## 要点
- paths.build 指向 Flutter 项目 build 下的 .cxx/debug/.../armeabi-v7a。
- paths.source 指向 Flutter tools 的 gradle 脚本目录。
- 描述的是单项目、单目录的 debug 配置，无 targets。

## 用途
CMake codemodel v2.3 格式，用于描述 Flutter/Android 原生 debug（armeabi-v7a）构建的目录与项目结构，供 IDE 或构建工具解析。
