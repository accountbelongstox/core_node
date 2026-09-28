# huo qu jue dui lu jing, bao zheng qi ta mulu zhi xing ci jiao benyi ran zheng que
{
cd $(dirname "$0")
script_path=$(pwd)
cd -
} &> /dev/null # disable output
# she zhidang qian mulu, cd de mulu ying xiang jie xia lai zhi xing cheng xu de gong zuo mulu
old_cd=$(pwd)
cd $(dirname "$0")

echo
echo
echo ---------------------------------------------------------------
echo pip install requirements
echo ---------------------------------------------------------------

pip install -r $script_path/package/requirements.txt
if [ $? -ne 0 ] ;then
    echo "pip install requirements failed"
    exit 1
fi

echo
echo
echo ---------------------------------------------------------------
echo create package
echo ---------------------------------------------------------------

python $script_path/package/package.py
if [ $? -ne 0 ] ;then
    echo "create package failed"
    exit 1
fi

# hui fu dang qian mulu
cd $old_cd
exit 0
