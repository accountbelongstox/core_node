# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

import json
import os
API_GROUPS = {
    "user": "用户相关接口",
    "friend": "好友与社交接口",
    "chat": "聊天消息接口",
    "health": "健康数据接口",
    "device": "设备管理接口",
    "location": "定位地图接口",
    "reminder": "提醒日程接口",
    "community": "社区互动接口",
    "system": "系统设置接口"
}

def read_design_rules():
    """读取设计规则文件"""
    design_rule_file = "./design_rule.md"
    try:
        with open(design_rule_file, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        print(f"警告：未找到设计规则文件 {design_rule_file}")
        return "# 默认设计规则\n\n请补充设计规则内容"
    except Exception as e:
        print(f"读取设计规则文件出错: {e}")
        return "# 错误\n\n无法读取设计规则"

def generate_api_files():
    """生成API文档文件"""
    design_rules = read_design_rules()
    output_dir = "./api_docs"
    
    os.makedirs(output_dir, exist_ok=True)
    
    for group_key, group_desc in API_GROUPS.items():
        json_data = {
            "api_group": group_key,
            "description": group_desc,
            "design_rules": design_rules,
            "interfaces": []
        }
        
        base_name = f"{group_key}.api.group"
        json_file = os.path.join(output_dir, f"{base_name}.json")
        md_file = os.path.join(output_dir, f"{base_name}.md")
        
        try:
            with open(json_file, "w", encoding="utf-8") as f:
                json.dump(json_data, f, ensure_ascii=False, indent=2)
            print(f"已创建: {json_file}")
        except Exception as e:
            print(f"创建JSON文件失败 {json_file}: {e}")
            continue
        
        try:
            md_content = f"""# {group_desc} ({group_key})

            ## 设计规范
            {design_rules}

            ## 接口组信息
            ```json
            {json.dumps(json_data, ensure_ascii=False, indent=2)}
            ```
            """
            with open(md_file, "w", encoding="utf-8") as f:
                f.write(md_content)
                print(f"已创建: {md_file}")
        except Exception as e:
            print(f"创建Markdown文件失败 {md_file}: {e}")
            continue

print("开始生成API文档...")
generate_api_files()
print("文档生成完成！")