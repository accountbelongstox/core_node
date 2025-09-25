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

"""
This module is to get the list of regions available in orginal subscription
"""


import re
import yaml
import modules.convert.converter as converter


# regions and the regular expression to match them

# parse yaml
async def parseSubs(content):
    try:
        proxies =  yaml.safe_dump(
            {"proxies": yaml.load(content, Loader=yaml.FullLoader).get("proxies")},
            allow_unicode=True,  # display characters like Chinese
            sort_keys=False  # keep the original sequence
        )
    except:
        proxies = yaml.safe_dump(
            {"proxies": await converter.ConvertsV2Ray(content)},
            allow_unicode=True,  # display characters like Chinese
            sort_keys=False  # keep the original sequence
        )
    return proxies

# create a dict containg resions and corresponding proxy group
async def mkListProxyNames(content: list):
    providerProxyNames = []
    if content:
        for u in content:
            # preprocess the content
            contentTmp = re.findall(r"- name: (.+)", u)
            providerProxyNames.extend(contentTmp)
    return providerProxyNames