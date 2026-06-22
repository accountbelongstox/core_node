Qt 5 and Qt 6 compatibility
The semantics of the CMake API in Qt 5 and Qt 6 are largely compatible, though some differences exist in the behavior of these commands and additional interfaces only in the latter versions. This guide is primarily meant for projects looking into gradual migration from one major release to another.

Up to Qt 5.14, all imported Qt library targets and commands contained the version number as part of the name, for example qt5_add_library. This makes writing CMake code that should work with both Qt 5 and Qt 6 somewhat cumbersome. Qt 5.15 therefore introduced versionless targets and commands, that is qt_add_library, to enable writing CMake code that is largely agnostic to the different Qt versions.

Versionless targets
In addition to the existing imported targets, Qt 5.15 introduced versionless targets. That is, to link against Qt Core one can both reference Qt6::Core, or Qt::Core:

find_package(Qt6 COMPONENTS Core)
if (NOT Qt6_FOUND)
    find_package(Qt5 5.15 REQUIRED COMPONENTS Core)
endif()

add_executable(helloworld
    ...
)

target_link_libraries(helloworld PRIVATE Qt::Core)

Above snippet first tries to find a Qt 6 installation. If that fails, it tries to find a Qt 5.15 package. Independent of whether Qt 6 or Qt 5 is used, we can use the imported Qt::Core target. To skip the Qt 6 check, set CMAKE_DISABLE_FIND_PACKAGE_Qt6 before the find_package call.

The versionless targets are defined by default. Set QT_NO_CREATE_VERSIONLESS_TARGETS before the first find_package() call to disable them.

Versionless commands
Since Qt 5.15, the Qt modules also provide versionless variants of their commands. You can for instance now use qt_add_translation to compile translation files, independent of whether you use Qt 5 or Qt 6.

Set QT_NO_CREATE_VERSIONLESS_FUNCTIONS before the first find_package() call to prevent the creation of versionless commands.

Mixing Qt 5 and Qt 6
There might be projects that need to load both Qt 5 and Qt 6 in one CMake context (though mixing Qt versions in one library or executable is not supported, so be careful there).

In such a setup the versionless targets and commands will be implicitly referring to the first Qt version that was found via find_package. Set the QT_DEFAULT_MAJOR_VERSION CMake variable before the first find_package call to make the version explicit.

Supporting Qt 5 versions older than 5.15
If you need to support also Qt 5 versions older than Qt 5.15, you can do so by storing the current version in an CMake variable (QT_VERSION_MAJOR):

find_package(Qt6 COMPONENTS Core)
if(Qt6_FOUND)
    set(QT_VERSION_MAJOR 6)
else()
    find_package(Qt5 REQUIRED COMPONENTS Core)
    set(QT_VERSION_MAJOR 5)
endif()

add_executable(helloworld
    ...
)

target_link_libraries(helloworld PRIVATE Qt${QT_VERSION_MAJOR}::Core)

Compared to the versionless approach, the targets point to Qt${QT_VERSION_MAJOR}::Core, which gets resolved to either Qt5::Core or Qt6::Core during the call of target_link_libraries.

Recommended practices
Use the versionless variants of the CMake commands where possible.

Use the versioned targets unless you have to support Qt 5 and Qt 6 in the same project.

If you have to use versionless targets, be aware of the Pitfalls when using versionless targets.

Use the versioned versions of the CMake commands and targets if you need to support Qt 5 versions older than Qt 5.15, or if you cannot control whether your CMake code is loaded in a context where QT_NO_CREATE_VERSIONLESS_FUNCTIONS or QT_NO_CREATE_VERSIONLESS_TARGETS might be defined. In this case you can still simplify your code by determining the actual command or target name through a variable.

Pitfalls when using versionless targets
Using the versionless targets has several downsides.

The versionless targets are usually ALIAS targets and you cannot make an ALIAS target pointing to an ALIAS target. Instead, use the ALIASED_TARGET target property.

For older Qt 6 versions, the imported Qt::Core target didn't feature all the target properties exposed by Qt6::Core. This is fixed if you link against Qt 6.8 or newer, with CMake 3.18 or newer.

Projects must not export targets that expose the versionless targets. For example, a library that is consumed by another project must not export targets that link publicly against versionless targets. Otherwise, transitive dependencies might be broken, or the user of that library mixes Qt5 and Qt6 targets involuntarily.

Unicode support in Windows
In Qt 6, the UNICODE and _UNICODE compiler definitions are set by default for targets that link against Qt modules. This is in line with the qmake behavior, but it is a change compared to the CMake API behavior in Qt 5.

Call qt_disable_unicode_defines() on the target to not set the definitions.

find_package(Qt6 COMPONENTS Core)

add_executable(helloworld
    ...
)

qt_disable_unicode_defines(helloworld)

Qt CMake policiesCMake Command Reference© 2025 The Qt Company Ltd. Documentation contributions included herein are the copyrights of their respective owners. The documentation provided herein is licensed under the terms of the GNU Free Documentation License version 1.3 as published by the Free Software Foundation. Qt and respective logos are trademarks of The Qt Company Ltd. in Finland and/or other countries worldwide. All other trademarks are property of their respective owners.