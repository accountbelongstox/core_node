A new long-term supported version, 6.5, of the Qt framework has recently been released. It introduces many fixes, improvements, and new features to the previous version. Some might be useful for your application (if not now, probably in the future), so it is a good idea to migrate your application to the latest version of the framework. 

I know many applications still use Qt 5, so migrating directly to the latest version of the framework won’t be easy. In this article, I want to point out the most critical steps for a smooth migration from Qt 5 to Qt 6. 

Qt 5 vs Qt 6 – migration? Why? 
We know that Qt is one of the best technologies when it comes to developing UI and human-machine interfaces. You might say that Qt 5 is good enough for you. Your application works perfectly well, and you don’t see any benefits of migration. Instead, you think about disadvantages, such as problems with building and running applications or countless hours of wasted time. I want to introduce to you the main advantages of Qt 6 and, later in this article, show that migration does not have to be a journey through hell. 

So, why Qt 6? 
Improved performance. Qt 6 introduces a new rendering pipeline that improves performance and reduces memory usage, resulting in faster and more responsive applications. 
Improved QML. QML has been enhanced with better performance, improved support for exporting C++ classes to QML and more powerful tooling for debugging QML code. The new Qt Quick Compiler allows you to precompile QML files for faster startup times. 
Improved modules. Some modules have been rewritten and improved, e.g., Qt Quick 3D, Qt Multimedia, and Qt WebEngine. Using the latest version of these modules will ensure that your application is up-to-date with current standards. 
Add-On modules. Many modules will be available as an add-ons. It will make the Qt binary smaller and allow you to download the module only when it is needed in the project. 
Unified backend. Qt 6 provides a single API for accessing platform-specific functionalities across several environments. This includes graphics, multimedia, input and windowing systems. 
Long-term support. Qt 5 has already reached its end of life, and while there are still security and bug fixes available for some of the older versions, any new features or functionality will only be available in Qt 6. If you don’t want your application to become obsolete too quickly, you should take up the migration. 
These are the main things that will ensure that using the latest version of Qt 6 will keep your application up to date with the latest features. The performance of your application will be better than before, and it will be easier to maintain the application in the future. 

Migration path to Qt 6 
If you are starting this chapter, it probably means you have decided to give Qt 6 a chance. Now I will outline the steps that need to be taken to make the migration as easy as possible. 

Step 1. Qt porting to Qt 5.15 
You may say, “Why? I don’t want to port my application to Qt 5.15! I want to port it to Qt 6”. You’re right, but sometimes it’s easier to take two small steps instead of one big one. In our case, porting the application to the last version of Qt 5 and then switching to Qt 6 is much easier. This is because Qt only released mechanisms to ease the migration to Qt 6 in version 5.15. What are these mechanisms, and how do I use them? This is described in step 4. Migrating from the previous version of Qt 5 to the latest version of Qt 5 should be straightforward. 

Step 2. Check modules changes 
In Qt 6, some of the modules available in Qt 5 are no longer available. The modules are removed, renamed or merged into a different module. Several of the removed modules are already refreshed and added to the framework in recent versions. 

By checking the module changes, you can ensure that your application will work as expected after migration. The possible solutions around how to behave when a module no longer exists can vary. Here are a couple of examples of the deprecated modules and how to update the code which uses them. 

Qt Quick Controls 1 → Use new Qt Quick Controls 2 
Qt Multimedia Widgets → Use QML API from Qt Multimedia 
Qt Graphical Effects → Use Qt5Compat module (Qt Quick MultiEffect since Qt 6.5) 
So, as you can see, your actions depend on the module you need to replace. The complete list of the removed modules and other changes can be found in Qt Documentation. 

“Do I need to check changes in every module in the documentation?” 

No, you don’t have to. It can help you find the correct replacement for deprecated API, but Qt tools can inform you about all parts of your code that are no longer supported. You’ll find more about this in step 4. 

Step 3. Qt porting: Check your environment 
Qt 6 requires a C++17 or higher compiler (e.g., for Windows – MinGW 8.1.0 or msvc 2019), so if you are using an older version, it is time to upgrade. The tools developed by Qt Company also support Qt 6 since specific versions. For Qt Creator, it is 4.14, and for Qt Design Studio, it is 2.0. 

If the correct compiler and tools are installed, the application prepared for Qt 6 should build and run correctly after porting. 

Step 4. Perform porting to Qt 6 
Get rid of deprecated features. 

In Qt 5.15, all things that will not be included in Qt 6 are marked as deprecated. By default, the use of this code will pop up as a compiler warning. But you have the option to treat it like an error. 

To ensure this, you need to define the QT_DISABLE_DEPRECATED_BEFORE. It should be set to 0x050F00. When the macro is specified, the deprecated functions (in a given version of Qt or any earlier) will be disabled. 

If you see any errors during the build, you should refactor that part. 

//qmake project file 
DEFINES += QT_DISABLE_DEPRECATED_BEFORE=0x050F00 
 
//CMakeLists.txt 
add_compile_definitions(QT_DISABLE_DEPRECATED_BEFORE=0x050F00) 

Output without macro. The app is built correctly. 

Output with macro. The app cannot be built.
Run clazy and get rid of these warnings. 

Clazy is a static analysis tool available as a plugin in QtCreator. Clazy can analyse the code and show you what should be improved. It is possible to tell Clazy explicitly what to check during execution. There are special options that need to be checked that can point to the part of the code that is not supported in Qt 6. Clazy is also able to fix these warnings itself, so the only thing you need to do is run the analyser. 

Clazy options that are helpful during porting: 

qt6-deprecated-api-fixes 
qt6-header-fixes 
qt6-qhash-signature 
qt6-fwd-fixes 
missing-qobject-macro 

Clazy configuration can be changed in Preferences → Analyzer → Clang tools → Diagnostic configuration. 

Clazy options helpful during porting. 

Example of output. 
Use Qt5Compat module where necessary. 

In Step 2, I mentioned something called the Qt5Compat module. What is it? 

The module was introduced to help you with the migration. It provides some of the classes that are gone in Qt 6, e.g., QRegExp, and QStringRef, but thanks to this it can still be used in Qt 6 applications. For example, the GraphicalEffects module. It is no longer available in Qt 6, but if your application uses a lot of effects, it will be hard to migrate easily without any regressions. That’s why Qt allows you to use the old API. 

That doesn’t mean it’s the right way. The old API should be replaced anyway. But the Qt5Compat module gives you time to find a replacement for anything deprecated. 

The use of the Qt Graphical Effects module is the perfect example. The module is gone in Qt 6 but will be re-introduced as MultiEffect in one of the next versions. So, in the meantime we can use the Qt5Compat module to ensure compatibility. But when the MultiEffect module is available, the code should be rewritten to cut off the outdated API. 

How to import the module into your project: 

//qmake project file 
QT += core5compat 
 
//CMakeLists.txt 
find_package(Qt6 REQUIRED COMPONENTS Core5Compat) 
target_link_libraries(mytarget PRIVATE Qt6::Core5Compat) 
The last thing you need to change is the change of the import statements in C++ or QML code. 

// Qt 5 
#include <QtCore/QRegExp> 
 
// Qt 6 
#include <QtCore5Compat/QRegExp> 
Step 5. Test application 
The testing of the application should be done as a final step. You should perform unit tests and check the visual output of the application. QML applications in Qt 6 use a new graphical backend, so making the regression checks is an important part of the migration. 

Of course, it can take some time to compare all the visual elements in the application, so it is a good practice to automate these tests. The screenshot of each view in the application can be compared pixel-by-pixel with the latest output, and you can be notified if something is wrong. 

Don’t worry if something looks different after the migration. You still have the option to manually use OpenGL calls (Qt OpenGL module) that were used by default in Qt 5. 

Summary: Benefit from Qt porting 
The migration from Qt 5 to Qt 6 may be daunting, but the steps above should ease the process. These steps include understanding the changes and new features in Qt 6, identifying potential compatibility issues, refactoring the necessary code, updating tools and building systems, and carefully testing the application. 

Migrating to Qt 6 is definitely well worth the time spent. Qt 6 provides many improvements and new features that are unavailable in the older version. It will make your application easier to maintain and develop for years to come.

We can help you with the migration. See our Qt offering for more information.

