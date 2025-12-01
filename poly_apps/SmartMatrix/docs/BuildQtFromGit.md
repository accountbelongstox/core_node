Building Qt 6 from Git
Jump to navigationJump to search
En Ar Bg De El Es Fa Fi Fr Hi Hu It Ja Kn Ko Ms Nl Pl Pt Ru Sq Th Tr Uk Zh

This article provides hints for checking out and building the Qt 6 repositories. This is primarily for developers who want to contribute to the Qt library or try the latest unreleased code.

If you want to build a specific release of Qt from sources to use the libraries in your project, you can download the source code from the Official Releases page or the Archive. Commercial customers can download the Source Packages via the Qt Account portal.

To compile Qt Creator, see Building Qt Creator from Git.
To compile Qt 5, see Building Qt 5 from Git.
For an overview of Linux Qt 6 distributions, see Linux distributions that build Qt 6.
For concepts and commands related to the build system, see Qt_Build_System_Glossary.

Contents
1	System Requirements
2	System Requirements - Qt WebEngine and Qt PDF
3	Getting the source code
3.1	Getting the submodule source code
4	Configuring and Building
4.1	On Linux:
4.2	On Windows:
4.3	On macOS for iOS:
4.4	Developer Builds
4.5	Running Tests
5	Tips
5.1	Working effectively with submodules
5.2	Importing an existing Qt build into Qt Creator
5.3	Building Qt from Qt Creator
5.4	Using CMake presets to ease code navigation and debugging
System Requirements
Git (>= 1.6.x)
CMake (>= 3.16, >= 3.18.4 for Ninja Multi-Config, >= 3.19 for WebEngine, >= 3.21.1 for static Qt builds in Qt 6.2+, or builds for Apple platforms in Qt 6.6+)
Ninja
C++ compiler supporting C++ 17
Python (>=2.6.x)
libclang: >=17, optional when QDoc should be built. Pre-built versions for each OS can be downloaded here. Alternatively, they can be installed through the clang-17, libclang-17-dev and llvm-17 packages on Linux.
Windows: Visual Studio 2022, Visual Studio 2019, MinGW 13.1.
Linux: OpenGL developing library (libgl-dev, libegl-dev), libfontconfig1-dev (for fonts to be rendered correctly), libinput-dev (for the XCB platform plugin), and the XCB libraries mentioned in https://doc.qt.io/qt-6/linux-requirements.html
Note for MSVC: Visual Studio 2019/2022 comes with CMake and ninja preinstalled. StrawberryPerl is a Perl version that does not need registration and comes as both an installer and a zip archive.

System Requirements - Qt WebEngine and Qt PDF
Qt WebEngine and Qt PDF have additional build requirements

Python (>=3.6.x)
Python html5lib
Bison, Flex
GPerf
Node.js version 8 or later (version 12 or later is recommended)
Windows: Visual Studio 2019 v16.11+ (required for QtWebEngine to address an issue with defaulted noexcept operators)
Windows: Windows 11 SDK version 10.0.22621.0 or later for QtWebEngine
Getting the source code
Note: If you plan to use Qt 6.7 or later, please follow the steps outlined in the Qt Documentation at Getting Qt Sources from the Git repository before skipping to 'Configuring and Building Qt' below. For older versions, follow the steps in this section.

First, clone the top-level Qt git repository into a directory of your choice. On Linux-type operating systems, it is common to clone the Qt source code into ~/qt6. On Windows, we recommend cloning the Qt source code into a directory with a short path, for example, C:\dev\qt6 to avoid path length limitations on this platform.

In your terminal, navigate to the directory that will contain the qt6 top-level repository and use the git command line to make a clone:

$ git clone git://code.qt.io/qt/qt5.git qt6
Alternatively, if you're behind a firewall and want to use the https protocol:

$ git clone https://code.qt.io/qt/qt5.git qt6
Do not worry about the name mentioning qt5.git. This is also used for Qt 6.

Then check out the target branch (see Branch Guidelines). New feature development happens in the dev branch, which has the latest changes. You may also check out sources for any publicly released and tagged version, or any currently active branch.

$ cd qt6
$ git switch dev
To build a specific release of Qt, you can switch to the desired tag:

$ cd qt6
$ git switch 6.5.3
This will check out the 6.5.3 release. You can see all branch names in the repo overview.

For commercial-only modules and commercial-only branches of public modules, see Getting Commercial Qt Sources.

Getting the submodule source code
Before configuring and building Qt, the Qt submodules must be initialized and configured. This can be done using the init-repository script, which checks out the submodules and configures Qt with git pre-commit hooks and user credentials. This usually only has to be done once after the initial clone and is unnecessary later, even if you pull upstream changes.

Note: If you use Qt 6.7 or newer, you can use the configure script described in the next section to initialize the repository without using init-repository. One benefit of using the configure script is that it makes it easier to configure a 'slimmed down' Qt build with only the submodules you need, vastly reducing the time needed for configuring and building Qt. See Getting Qt Sources from the Git repository.

Relevant options for init-repository:

--module-subset : For example, to get modules for Qt Quick development: --module-subset=qtbase,qtshadertools,qtdeclarative. You can add or remove individual submodules later with git submodule init/deinit.
--codereview-username <Jira/Gerrit username> : If you plan to contribute to Qt, you may specify your codereview username (pay attention to capitalization!) so that the git remotes are properly set up. Note that it is recommended to adjust your ssh configuration instead.
$ cd qt6
$ init-repository
On Windows:

> .\init-repository.bat
Configuring and Building
Qt 6 is built with CMake and can be configured by running CMake with appropriate options. Qt also has a configure script, making it easier to call CMake with the correct arguments. This configure script (configure.bat on Windows) is located in the directory you git-cloned the source code into (~/qt6 if you followed the directions above).

When configuring the Qt build, we recommend to keep the build directory separate from the source code. This is done by calling CMake or configure from a different, parallel-level directory.

On Linux:
$ mkdir qt6-build
$ cd qt6-build
$ ../qt6/configure -prefix /path/to/install
$ cmake --build . --parallel 4
$ cmake --install .
Where 4 is the number of jobs. You can try your own value or use auto value using --parallel without argument.

Where dot after "--build ." means current folder.

On Windows:
Open the correct command prompt (e.g. 'x64 Native Tools Command Prompt for VS 2022'), which properly sets up the needed environment variables. Also, make sure that Ninja can be found (by adding the path to ninja,exe to your PATH env var)

> mkdir qt6-build
> cd qt6-build
> ..\qt6\configure.bat -prefix C:\path\to\install
> cmake --build .
> cmake --install .
  Note: In case of debug and release build please use "ninja install" instead of "cmake --install ." due to cmake issue

Run configure -help to get an overview of available options.

You may also pass CMake options directly to configure:

 > ../qt6/configure -- -DQT_BUILD_TESTS=ON
All options specified after a double-dash (--), will be passed verbatim to CMake.

See cmake/configure-cmake-mapping.md in the sources for an overview of available options and how they map to CMake options.

On macOS for iOS:
Here is an example of CMake configure arguments used to build Qt for iOS on macOS:

-DCMAKE_BUILD_TYPE=Debug -DFEATURE_developer_build=ON -DQT_BUILD_TESTS=OFF -DQT_BUILD_EXAMPLES=ON -DQT_BUILD_EXAMPLES_BY_DEFAULT=OFF -DCMAKE_SYSTEM_NAME=iOS -DQT_HOST_PATH=~/dev/qt-dev-debug-non-fw/qtbase
Note that configuring tests as part of the build when targeting iOS is somewhat pointless because you won't be able to run them. To run an iOS app (or test), they need to be built with the xcode generator, and building the tests in-tree means they will be built with ninja. So you need to configure each test manually in a separate build directory.

Developer Builds
The configure option -developer-build sets the install prefix to the build directory and no install step is necessary. It also changes defaults so that all tests (including tests using private API that is otherwise not exported) can run.

This can take quite some time, though. If you do want to be able to build the tests, but only on request, configure with CMake variable QT_BUILD_TESTS_BY_DEFAULT=OFF:

 $ ../qt6/configure -developer-build -- -DQT_BUILD_TESTS_BY_DEFAULT=OFF
 $ cmake --build . --parallel
Later on, you can then build single tests, for instance :

 $ cmake --build . --target tst_qstyle
Use ninja -t targets to see all the targets provided in the build.

See cmake/README.md in the sources for details on configuring and building Qt 6 with CMake.

Running Tests
Once you've built (as long as you did build with tests enabled), you can run the tests either directly using ninja tst_qlocale_check (for example, to run tests/auto/corelib/text/qlocale/tst_qlocale) or via ctest (see its man page for further options) like

 $ ctest -V -R qlocale
(for the same example); the parameter to -R is a regular expression, matching test names. This includes the test output; if you omit -V that's skipped and you just get a single-line summary of the test result.

If you want to run only a particular test function, you pass it using the TESTARGS environment variable. For example:

$ TESTARGS=emptyCtor  ctest -V -R qlocale
And if you want to run a specific test function with a specific data-tag, you provide it after a colon:

$ TESTARGS=emptyCtor:en_GB  ctest -V -R qlocale
Tips
Working effectively with submodules
Use the configure script's -submodules option to reduce configuration and build times. If you plan to test functionality in the qtmultimedia submodule, you can configure qtmultimedia and all submodules that qtmultimedia depends on like this:

$ ../qt6/configure -developer-build -submodules qtmultimedia && ninja
If you haven't initialized your source tree yet, you can reduce the number of checked-out submodules when you initialize the Qt repository. This way, only the submodule you specify and the submodules it depends on will be cloned into your source tree.

$ ../qt6/configure -developer-build -submodules qtmultimedia -init-submodules -codereview-username <gerrit username> && ninja
If you plan to actively develop one specific submodule, it is a good idea to first configure and build a main build, as suggested above, and then configure the single submodule build separately. This way, you can enable tests and examples only for the submodule you are developing, and reconfiguring or rebuilding the submodule is much faster than reconfiguring and rebuilding all of Qt.

$ mkdir ~/qt6-multimedia-build
$ ../qt6-build/qtbase/bin/qt-configure-module ../qt6/qtmultimedia -- -DQT_BUILD_TESTS=ON -DQT_BUILD_TESTS_BY_DEFAULT=OFF
Once you build this Qt submodule configuration, its build artifacts will be copied to ../qt6-build/qtbase/ and work the same way as if you built the main build. If there are changes to dependent submodules, the main build has to be built again as before, before you build the submodule again.

Importing an existing Qt build into Qt Creator
If you have already set up and compiled Qt using the command line, you can import that build into Qt Creator. This technique is particularly useful with single-submodule builds as described above. Such builds are small enough to keep the editor's responsiveness good. If the submodule was configured with tests and examples enabled, imported builds make it easy to debug tests or examples directly in Qt Creator while at the same time having all of the submodule's source code available and indexed for fast code navigation.

Open the submodule's CMakeList.txt as a project in Qt Creator.
In the 'Projects' menu, select 'Import existing build' and navigate to the build directory for the submodule.
Qt Creator will now re-use the configuration used initially when configuring from the command line. Once built, the submodule is ready for development and debugging.

Building Qt from Qt Creator
You can use Qt Creator to build Qt if you have initialized the submodules as described in the previous sections. This is particularly useful when facing CMake issues and wanting to use the CMake debugger in Qt Creator. It is also helpful to debug tests or examples while having all of Qt's source code available while you debug.

In Qt Creator, Go to Edit->Preferences->kits.
Add a new kit and change the Qt version to 'none.'
Open qt6/CMakeLists.txt as a project in Qt Creator and select the kit you just created. You may change the target directory before configuring Qt.
Once configured, it is recommended that you turn off any unnecessary submodules in the CMake settings in the 'Projects' menu, for example, by setting all submodules except BUILD_qtbase to OFF. Otherwise, the configuration may be too big and make Qt Creator slow.
You can change CMake options in the 'Projects' menu, for example, by setting FEATURE_developer_build=ON, QT_BUILD_TESTS=ON, and QT_BUILD_TESTS_BY_DEFAULT=OFF before you rerun CMake.
Build Qt from the Build menu
All auto-tests will appear as debug targets once Qt is built according to the above description. If You want to debug a test, build that test first because tests are not built by default as long as QT_BUILD_TESTS_BY_DEFAULT is set to OFF.

Using CMake presets to ease code navigation and debugging
Some integrated development environments (IDEs), such as Visual Studio Code and Visual Studio 2022, have great IntelliSense features that assist in navigating the Qt source code. These features work best when CMake is called through the IDE to configure Qt. For instance, if you are working with qtbase, you can create a file called qt6/qtbase/CMakeUserPresets.json and specify the CMake options required by qtbase in that file. When you open the qt6/qtbase folder in an IDE that supports CMake presets, it will configure Qt using the options from the preset file. This enables you to configure and build qtbase directly from your IDE, and you can even run and debug tests directly from the IDE.

The example below shows a CMakeUserPresets.json file for Windows. In this example, qtbase will be configured and built into C:\dev\qtbase-build, with tests enabled. All Qt auto-tests will be available as debugging targets in your IDE. We set the path in the environment block to ensure the correct libraries are loaded during debugging. Remember to update the binaryDir and environment sections according to your compiler and directory layout. Also, make sure toolchain environment variables are set before launching the IDE. With Visual Studio Code on Windows, you can start VS code from the x64 Native Tools Command Prompt. This is not necessary with Visual Studio 2022, because it sets necessary toolchain variables itself.

{
  "version": 5,
  "configurePresets": [
    {
      "name": "qtbase",
      "generator": "Ninja",
      "binaryDir": "C:/dev/qtbase-build",
      "cacheVariables": {
        "FEATURE_developer_build": true,
        "QT_BUILD_TESTS": true,
        "QT_BUILD_TESTS_BY_DEFAULT": false,
        "CMAKE_BUILD_TYPE": "Debug"
      },
      "environment": {
        "PATH": "C:/dev/qtbase-build/bin;$penv{PATH}"
      }
    }
  ]
}