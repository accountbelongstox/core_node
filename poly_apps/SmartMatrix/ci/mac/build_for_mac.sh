
echo
echo
echo ---------------------------------------------------------------
echo check ENV
echo ---------------------------------------------------------------

# cong huanjing bian liang huo qu bi yao can shu
# li ru /Users/barry/Qt5.12.5/5.12.5
echo ENV_QT_PATH $ENV_QT_PATH

# huo qu jue dui lu jing, bao zheng qi ta mulu zhi xing ci jiao benyi ran zheng que
{
cd $(dirname "$0")
script_path=$(pwd)
cd -
} &> /dev/null # disable output
# she zhidang qian mulu, cd de mulu ying xiang jie xia lai zhi xing cheng xu de gong zuo mulu
old_cd=$(pwd)
cd $(dirname "$0")

# qi dong can shu sheng ming
build_mode=RelWithDebInfo
cpu_arch=arm64

echo
echo
echo ---------------------------------------------------------------
echo check build param[Debug/Release/MinSizeRel/RelWithDebInfo]
echo ---------------------------------------------------------------

# bian yi can shu jian cha
build_mode=$(echo $1)
if [[ $build_mode != "Release" && $build_mode != "Debug" && $build_mode != "MinSizeRel" && $build_mode != "RelWithDebInfo" ]]; then
    echo "error: unkonow build mode -- $1"
    exit 1
fi

echo
echo
echo ---------------------------------------------------------------
echo check cpu arch[x64/arm64]
echo ---------------------------------------------------------------

cpu_arch=$(echo $2)
if [[ $cpu_arch != "x64" && $cpu_arch != "arm64" ]]; then
    echo "error: unkonow cpu mode -- $2"
    exit 1
fi

# ti shi
echo current build mode: $build_mode
echo current cpu mode: $cpu_arch

cmake_arch=x86_64
if [ $cpu_arch == "x64" ]; then
    qt_cmake_path=$ENV_QT_PATH/clang_64/lib/cmake/Qt5
    cmake_arch=x86_64
else
    qt_cmake_path=$ENV_QT_PATH/macos/lib/cmake/Qt6
    cmake_arch=arm64
fi

echo
echo
echo ---------------------------------------------------------------
echo begin cmake build
echo ---------------------------------------------------------------

# shan chu shu chu mulu
output_path=$script_path../../output
if [ -d "$output_path" ]; then
    rm -rf $output_path
fi
# shan chu bian yi mulu
build_path=$script_path/../build_temp
if [ -d "$build_path" ]; then
    rm -rf $build_path
fi
mkdir $build_path
cd $build_path

cmake_params="-DCMAKE_PREFIX_PATH=$qt_cmake_path -DCMAKE_BUILD_TYPE=$build_mode -DCMAKE_OSX_ARCHITECTURES=$cmake_arch"
cmake $cmake_params ../..
if [ $? -ne 0 ] ;then
    echo "cmake failed"
    exit 1
fi

cmake --build . --config $build_mode -j8
if [ $? -ne 0 ] ;then
    echo "cmake build failed"
    exit 1
fi

echo
echo
echo ---------------------------------------------------------------
echo finish!!!
echo ---------------------------------------------------------------

# hui fu dang qian mulu
cd $old_cd
exit 0
