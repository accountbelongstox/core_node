#!/bin/bash

cd 'D:/programing/core_node/poly_apps/laravel_main'

echo "========================================"
echo "Apps目录代码合并检查报告"
echo "========================================"
echo ""

# 定义应用列表
apps=("AChatV1" "AwyV0" "BankV1" "DictV1" "ItToolsV1" "ServerManagerV1")

# 初始化统计变��
total_files=0
identical_files=0
different_files=0
only_in_app=0
needs_merge=0

for app in "${apps[@]}"; do
  echo "=== $app 应用比较 ==="
  echo ""

  # 获取两个位置的所有文件
  root_files=$(find "Apps/$app" -type f 2>/dev/null)
  app_files=$(find "app/Apps/$app" -type f 2>/dev/null)

  # 统计文件数量
  root_count=$(echo "$root_files" | grep -v '^$' | wc -l)
  app_count=$(echo "$app_files" | grep -v '^$' | wc -l)

  echo "根Apps/$app: $root_count 文件"
  echo "app/Apps/$app: $app_count 文件"
  echo ""

  # 比较共同文件
  for file in $root_files; do
    filename=$(basename "$file")
    subdir=$(dirname "$file" | sed "s|Apps/$app||")

    app_file="app/Apps/$app$subdir/$filename"

    if [ -f "$app_file" ]; then
      total_files=$((total_files + 1))

      # 比较文件内容
      if diff -q "$file" "$app_file" > /dev/null 2>&1; then
        echo "✓ $subdir/$filename (相同)"
        identical_files=$((identical_files + 1))
      else
        echo "✗ $subdir/$filename (不同 - app版本更新)"
        different_files=$((different_files + 1))

        # 显示行数差异
        root_lines=$(wc -l < "$file" 2>/dev/null || echo "0")
        app_lines=$(wc -l < "$app_file" 2>/dev/null || echo "0")
        echo "  根版本: $root_lines 行, app版本: $app_lines 行"
      fi
    else
      echo "⚠ $subdir/$filename (仅存在于根Apps/)"
      needs_merge=$((needs_merge + 1))
    fi
  done

  # 检查app/Apps中的额外文件
  echo ""
  echo "app/Apps/$app 中的额外文件:"
  for file in $app_files; do
    filename=$(basename "$file")
    subdir=$(dirname "$file" | sed "s|app/Apps/$app||")

    root_file="Apps/$app$subdir/$filename"

    if [ ! -f "$root_file" ]; then
      echo "+ $subdir/$filename (仅app/Apps中有)"
      only_in_app=$((only_in_app + 1))
    fi
  done

  echo ""
  echo "---"
  echo ""
done

echo "========================================"
echo "总体统计"
echo "========================================"
echo "共同文件总数: $total_files"
echo "相同文件: $identical_files"
echo "不同文件: $different_files (app版本更新)"
echo "仅app/Apps中有: $only_in_app (新功能)"
echo "需要手动合并: $needs_merge"
echo ""

if [ $needs_merge -eq 0 ]; then
  echo "✓ 结论: app/Apps/ 目录包含所有代码，可以安全删除根 Apps/ 目录"
  exit 0
else
  echo "✗ 结论: 发现需要合并的代码，请手动检查上述文件"
  exit 1
fi
