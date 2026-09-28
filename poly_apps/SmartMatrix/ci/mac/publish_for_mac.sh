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
publish_dir=$1
cpu_arch=$2

echo
echo
echo ---------------------------------------------------------------
echo check cpu arch[x64/arm64]
echo ---------------------------------------------------------------

if [[ $cpu_arch != "x64" && $cpu_arch != "arm64" ]]; then
    echo "error: unkonow cpu mode -- $2"
    exit 1
fi

# ti shi
echo current cpu mode: $cpu_arch

if [ $cpu_arch == "x64" ]; then
    qt_clang_path=$ENV_QT_PATH/clang_64
else
    qt_clang_path=$ENV_QT_PATH/macos
fi

# ti shi
echo current publish dir: $publish_dir

# huanjing bian liang she zhi
keymap_path=$script_path/../../keymap
# config_path=$script_path/../../config

publish_path=$script_path/$publish_dir
release_path=$script_path/../../output/$cpu_arch/RelWithDebInfo

export PATH=$qt_clang_path/bin:$PATH

if [ -d "$publish_path" ]; then
    rm -rf $publish_path
fi

# fu zhi yao fa bu de bao
cp -r $release_path $publish_path
cp -r $keymap_path $publish_path/QtScrcpy.app/Contents/MacOS
# cp -r $config_path $publish_path/QtScrcpy.app/Contents/MacOS

# tianjiaqt yi lai bao
macdeployqt $publish_path/QtScrcpy.app

# shan chu duo yuqt yi lai bao

# PlugIns
rm -rf $publish_path/QtScrcpy.app/Contents/PlugIns/iconengines
# jietu gong neng xu yaolibqjpeg.dylib
rm -f $publish_path/QtScrcpy.app/Contents/PlugIns/imageformats/libqgif.dylib
rm -f $publish_path/QtScrcpy.app/Contents/PlugIns/imageformats/libqicns.dylib
rm -f $publish_path/QtScrcpy.app/Contents/PlugIns/imageformats/libqico.dylib
# rm -f $publish_path/QtScrcpy.app/Contents/PlugIns/imageformats/libqjpeg.dylib
rm -f $publish_path/QtScrcpy.app/Contents/PlugIns/imageformats/libqmacheif.dylib
rm -f $publish_path/QtScrcpy.app/Contents/PlugIns/imageformats/libqmacjp2.dylib
rm -f $publish_path/QtScrcpy.app/Contents/PlugIns/imageformats/libqtga.dylib
rm -f $publish_path/QtScrcpy.app/Contents/PlugIns/imageformats/libqtiff.dylib
rm -f $publish_path/QtScrcpy.app/Contents/PlugIns/imageformats/libqwbmp.dylib
rm -f $publish_path/QtScrcpy.app/Contents/PlugIns/imageformats/libqwebp.dylib
rm -rf $publish_path/QtScrcpy.app/Contents/PlugIns/virtualkeyboard
rm -rf $publish_path/QtScrcpy.app/Contents/PlugIns/printsupport
rm -rf $publish_path/QtScrcpy.app/Contents/PlugIns/platforminputcontexts
rm -rf $publish_path/QtScrcpy.app/Contents/PlugIns/iconengines
rm -rf $publish_path/QtScrcpy.app/Contents/PlugIns/bearer

# Frameworks
rm -rf $publish_path/QtScrcpy.app/Contents/Frameworks/QtVirtualKeyboard.framework
rm -rf $publish_path/Contents/Frameworks/QtSvg.framework

# qml
rm -rf $publish_path/QtScrcpy.app/Contents/Frameworks/QtQml.framework
rm -rf $publish_path/QtScrcpy.app/Contents/Frameworks/QtQuick.framework

echo
echo
echo ---------------------------------------------------------------
echo finish!!!
echo ---------------------------------------------------------------

# hui fu dang qian mulu
cd $old_cd
exit 0
