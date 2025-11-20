<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

```mermaid
graph TD
    %% Global Legend
    subgraph Legend [图例]
        direction LR
        start_point([流程起点])-.->process_step{{过程步骤}}
        process_step-.->decision_point{决策点}
        decision_point-.->sub_process[/子流程/]
        sub_process-.->database[(数据存储/交互)]
        process_step-.->actor_node[[角色]]
        manual_task[手动操作] -- Manual Input --> auto_task{{自动化/AI处理}}
    end

    %% Section 1: User Onboarding and Role Management
    subgraph S1 [第一部分: 用户注册与角色管理]
        direction TB

        subgraph S1_Dev [1.1 开发者注册流程]
            direction TB
            S1_Dev_Start(新用户访问平台) --> S1_Dev_P1[点击 "成为开发者"]
            S1_Dev_P1 --> S1_Dev_P2{{1. 填写基本注册信息}}
            S1_Dev_P2 --> S1_Dev_P3(输入邮箱, 密码)
            S1_Dev_P3 --> S1_Dev_P4{{系统: 发送验证邮件}}
            S1_Dev_P4 --> S1_Dev_P5[用户: 检查邮箱并点击验证链接]
            S1_Dev_P5 --> S1_Dev_P6{邮箱验证成功?}
            S1_Dev_P6 -- No --> S1_Dev_P4
            S1_Dev_P6 -- Yes --> S1_Dev_P7{{2. 手机号码验证}}
            S1_Dev_P7 --> S1_Dev_P8(输入手机号, 请求验证码)
            S1_Dev_P8 --> S1_Dev_P9{{系统: 发送短信OTP}}
            S1_Dev_P9 --> S1_Dev_P10[用户: 输入收到的OTP]
            S1_Dev_P10 --> S1_Dev_P11{OTP正确?}
            S1_Dev_P11 -- No --> S1_Dev_P8
            S1_Dev_P11 -- Yes --> S1_Dev_P12{{3. 实名认证 (KYC)}}
            S1_Dev_P12 --> S1_Dev_P13[上传身份证件 (正面/反面)]
            S1_Dev_P13 --> S1_Dev_P14{{AI: OCR识别证件信息}}
            S1_Dev_P14 --> S1_Dev_P15{自动识别成功?}
            S1_Dev_P15 -- No --> S1_Dev_P16[转入人工审核队列]
            S1_Dev_P16 --> S1_Dev_P17[后台管理员: 手动比对信息]
            S1_Dev_P17 --> S1_Dev_P18{人工审核通过?}
            S1_Dev_P18 -- No --> S1_Dev_P19(通知用户重新上传) --> S1_Dev_P13
            S1_Dev_P15 -- Yes --> S1_Dev_P18
            S1_Dev_P18 -- Yes --> S1_Dev_P20{{4. 缴纳开发者保证金}}
            S1_Dev_P20 --> S1_Dev_P21[选择支付方式: 支付宝/微信/银行卡]
            S1_Dev_P21 --> S1_Dev_P22[/跳转至第三方支付网关/]
            S1_Dev_P22 --> S1_Dev_P23{支付成功?}
            S1_Dev_P23 -- No --> S1_Dev_P24(支付失败, 提示用户) --> S1_Dev_P21
            S1_Dev_P23 -- Yes --> S1_Dev_P25(支付成功, 更新账户状态)
            S1_Dev_P25 --> S1_Dev_P26[(写入用户数据库: 认证状态, 保证金金额)]
            S1_Dev_P26 --> S1_Dev_End[[认证开发者]]
        end

        subgraph S1_Client [1.2 客户注册流程]
            direction TB
            S1_Client_Start(新用户访问平台) --> S1_Client_P1[点击 "发布项目"]
            S1_Client_P1 --> S1_Client_P2{{填写注册信息}}
            S1_Client_P2 --> S1_Client_P3(输入公司名, 联系方式, 邮箱)
            S1_Client_P3 --> S1_Client_P4{{系统: 发送验证邮件}}
            S1_Client_P4 --> S1_Client_P5[用户: 点击验证链接]
            S1_Client_P5 --> S1_Client_P6{验证成功?}
            S1_Client_P6 -- No --> S1_Client_P4
            S1_Client_P6 -- Yes --> S1_Client_P7[(写入用户数据库: 客户角色)]
            S1_Client_P7 --> S1_Client_End[[客户]]
        end

        subgraph S1_Architect [1.3 开发者晋升为框架师]
            direction TB
            S1_Arch_Start[[认证开发者]] --> S1_Arch_P1{{1. 系统持续追踪开发者表现}}
            S1_Arch_P1 --> S1_Arch_P2[(记录: 完成项目数, 代码平均分, 客户满意度)]
            S1_Arch_P2 --> S1_Arch_P3{{系统: 每日检查晋升资格}}
            S1_Arch_P3 --> S1_Arch_P4{达到晋升标准?}
            S1_Arch_P4 -- No --> S1_Arch_P1
            S1_Arch_P4 -- Yes --> S1_Arch_P5[在开发者后台显示 "申请框架师" 按钮]
            S1_Arch_P5 --> S1_Arch_P6[开发者: 点击申请]
            S1_Arch_P6 --> S1_Arch_P7{{2. 框架师资格确认}}
            S1_Arch_P7 --> S1_Arch_P8[阅读并同意框架师责任与条款]
            S1_Arch_P8 --> S1_Arch_P9{{3. 缴纳额外保证金}}
            S1_Arch_P9 --> S1_Arch_P10[/复用支付流程/]
            S1_Arch_P10 --> S1_Arch_P11{支付成功?}
            S1_Arch_P11 -- No --> S1_Arch_P9
            S1_Arch_P11 -- Yes --> S1_Arch_P12[(更新用户数据库: 角色->框架师)]
            S1_Arch_P12 --> S1_Arch_End[[框架师]]
        end

        subgraph S1_Reviewer [1.4 任何用户申请成为点评人员]
            direction TB
            S1_Reviewer_Start[[任何认证用户]] --> S1_Reviewer_P1[个人中心找到 "申请成为点评员"]
            S1_Reviewer_P1 --> S1_Reviewer_P2{{1. 阅读点评员指南}}
            S1_Reviewer_P2 --> S1_Reviewer_P3{{2. 参加资格测试}}
            S1_Reviewer_P3 --> S1_Reviewer_P4{{系统: 随机抽取3个已完成的匿名代码片段}}
            S1_Reviewer_P4 --> S1_Reviewer_P5[申请人: 对代码进行评分和评论]
            S1_Reviewer_P5 --> S1_Reviewer_P6{{AI: 对比申请人的评分与该代码的最终得分}}
            S1_Reviewer_P6 --> S1_Reviewer_P7{相似度 > 85%?}
            S1_Reviewer_P7 -- No --> S1_Reviewer_P8(测试失败, 7天后可重试) --> S1_Reviewer_P1
            S1_Reviewer_P7 -- Yes --> S1_Reviewer_P9(测试通过)
            S1_Reviewer_P9 --> S1_Reviewer_P10[(更新用户数据库: 赋予点评者权限)]
            S1_Reviewer_P10 --> S1_Reviewer_End[[点评者]]
        end
    end

    %% Section 2: Project Initiation Flow
    subgraph S2 [第二部分: 项目启动流程]
        direction TB

        subgraph S2_Submit [2.1 客户提交开发需求]
            direction TB
            S2_Submit_Start[[客户]] --> S2_Submit_P1[登录客户后台, 点击 "创建新任务"]
            S2_Submit_P1 --> S2_Submit_P2[/进入多步骤提交表单/]
            S2_Submit_P2 --> S2_Submit_P3{{Step 1: 核心信息}}
            S2_Submit_P3 --> S2_Submit_P4[输入项目标题]
            S2_Submit_P4 --> S2_Submit_P5[输入项目一句话简介]
            S2_Submit_P5 --> S2_Submit_P6{{Step 2: 详细需求}}
            S2_Submit_P6 --> S2_Submit_P7[使用富文本编辑器输入详细描述]
            S2_Submit_P7 --> S2_Submit_P8{{Step 3: 上传附件}}
            S2_Submit_P8 --> S2_Submit_P9[上传需求文档 (PDF, Word)]
            S2_Submit_P9 --> S2_Submit_P10[上传设计图/截图 (JPG, PNG)]
            S2_Submit_P10 --> S2_Submit_P11[上传数据样本 (Excel, CSV)]
            S2_Submit_P11 --> S2_Submit_P12{{Step 4: 提供参考示例}}
            S2_Submit_P12 --> S2_Submit_P13[输入参考网站URL]
            S2_Submit_P13 --> S2_Submit_P14[粘贴参考代码片段]
            S2_Submit_P14 --> S2_Submit_P15{{Step 5: 预算与周期}}
            S2_Submit_P15 --> S2_Submit_P16[选择预算范围]
            S2_Submit_P16 --> S2_Submit_P17[选择期望交付日期]
            S2_Submit_P17 --> S2_Submit_P18[预览所有输入信息]
            S2_Submit_P18 --> S2_Submit_P19{确认提交?}
            S2_Submit_P19 -- No --> S2_Submit_P2
            S2_Submit_P19 -- Yes --> S2_Submit_P20[(创建任务记录, 状态:待分析)]
            S2_Submit_P20 --> S2_Submit_End(任务提交成功)
        end

        subgraph S2_AI [2.2 平台AI分析与方案生成]
            direction TB
            S2_AI_Start(新任务创建) --> S2_AI_P1{{触发AI分析引擎}}
            S2_AI_P1 --> S2_AI_P2{{1. 需求解析}}
            S2_AI_P2 --> S2_AI_P3{{AI: NLP处理标题和描述, 提取关键词}}
            S2_AI_P3 --> S2_AI_P4{{AI: 分析附件内容 (文档/OCR/表格)}}
            S2_AI_P4 --> S2_AI_P5{{2. 技术选型推荐}}
            S2_AI_P5 --> S2_AI_P6{{AI: 基于需求关键词匹配知识库}}
            S2_AI_P6 --> S2_AI_P7(推荐开发语言: e.g., Python, JS, Go)
            S2_AI_P7 --> S2_AI_P8(推荐框架: e.g., Django, React, Gin)
            S2_AI_P8 --> S2_AI_P9(推荐数据库: e.g., MySQL, MongoDB)
            S2_AI_P9 --> S2_AI_P10{{3. 人员配比建议}}
            S2_AI_P10 --> S2_AI_P11{{AI: 评估项目复杂度}}
            S2_AI_P11 --> S2_AI_P12(建议人员构成: e.g., 1x高级, 2x中级)
            S2_AI_P12 --> S2_AI_P13{{4. 工时与成本估算}}
            S2_AI_P13 --> S2_AI_P14{{AI: 基于历史同类项目数据估算工时}}
            S2_AI_P14 --> S2_AI_P15(生成初步报价)
            S2_AI_P15 --> S2_AI_P16{{5. 生成方案报告}}
            S2_AI_P16 --> S2_AI_P17[(将方案报告与任务关联, 状态:待客户确认)]
            S2_AI_P17 --> S2_AI_P18{{系统: 通知客户审核方案}}
            S2_AI_P18 --> S2_AI_End(方案已生成)
        end

        subgraph S2_Confirm [2.3 客户确认与支付]
            direction TB
            S2_Confirm_Start(客户收到通知) --> S2_Confirm_P1[登录并查看AI生成的方案]
            S2_Confirm_P1 --> S2_Confirm_P2{对方案满意?}
            S2_Confirm_P2 -- No --> S2_Confirm_P3[填写修改意见]
            S2_Confirm_P3 --> S2_Confirm_P4(e.g., "希望使用Vue而非React")
            S2_Confirm_P4 --> S2_Confirm_P5[(提交修改意见, 任务状态:待AI复核)]
            S2_Confirm_P5 --> S2_AI_P1
            S2_Confirm_P2 -- Yes --> S2_Confirm_P6[点击 "接受方案并支付"]
            S2_Confirm_P6 --> S2_Confirm_P7{{支付首付款}}
            S2_Confirm_P7 --> S2_Confirm_P8[/复用支付流程/]
            S2_Confirm_P8 --> S2_Confirm_P9{支付成功?}
            S2_Confirm_P9 -- No --> S2_Confirm_P7
            S2_Confirm_P9 -- Yes --> S2_Confirm_P10[(创建项目, 状态:待分配框架师)]
            S2_Confirm_P10 --> S2_Confirm_P11{{系统: 通知公司管理人员}}
            S2_Confirm_P11 --> S2_Confirm_End(项目正式启动)
        end
    end

    %% Section 3: Development and Execution
    subgraph S3 [第三部分: 开发执行与监控]
        direction TB

        subgraph S3_Assign [3.1 团队分配与任务分解]
            direction TB
            S3_Assign_Start(项目启动) --> S3_Assign_P1[[公司管理]]
            S3_Assign_P1 --> S3_Assign_P2[查看项目需求和AI建议]
            S3_Assign_P2 --> S3_Assign_P3{{1. 分配框架师}}
            S3_Assign_P3 --> S3_Assign_P4{{系统: 筛选可用框架师(技能/负载)}}
            S3_Assign_P4 --> S3_Assign_P5[管理员: 指派1位或多位框架师]
            S3_Assign_P5 --> S3_Assign_P6(e.g., 前端框架师A, 后端框架师B)
            S3_Assign_P6 --> S3_Assign_P7{{系统: 通知被指派的框架师}}
            S3_Assign_P7 --> S3_Assign_P8[[框架师]]
            S3_Assign_P8 --> S3_Assign_P9[接受或拒绝任务]
            S3_Assign_P9 --> S3_Assign_P10{{2. 框架师创建开发文档和任务}}
            S3_Assign_P10 --> S3_Assign_P11[创建Git仓库和项目骨架]
            S3_Assign_P11 --> S3_Assign_P12[编写详细的技术设计文档]
            S3_Assign_P12 --> S3_Assign_P13[将大任务分解为小的开发卡片]
            S3_Assign_P13 --> S3_Assign_P14[(在项目管理工具中创建Tasks)]
            S3_Assign_P14 --> S3_Assign_P15{{3. 推送任务到开发大厅}}
            S3_Assign_P15 --> S3_Assign_P16[为每个Task定义技能标签, 预估工时]
            S3_Assign_P16 --> S3_Assign_P17{{系统: 将Tasks发布到任务大厅}}
            S3_Assign_P17 --> S3_Assign_End((任务大厅))
        end

        subgraph S3_Dev [3.2 开发者执行任务]
            direction TB
            S3_Dev_Start[[认证开发者]] --> S3_Dev_P1[在任务大厅浏览/搜索任务]
            S3_Dev_P1 --> S3_Dev_P2[点击任务查看详情]
            S3_Dev_P2 --> S3_Dev_P3{决定接受任务?}
            S3_Dev_P3 -- No --> S3_Dev_P1
            S3_Dev_P3 -- Yes --> S3_Dev_P4{{系统: 检查开发者资格}}
            S3_Dev_P4 --> S3_Dev_P5{认证状态 & 保证金充足?}
            S3_Dev_P5 -- No --> S3_Dev_P6(提示开发者不满足条件)
            S3_Dev_P5 -- Yes --> S3_Dev_P7[(将任务分配给该开发者)]
            S3_Dev_P7 --> S3_Dev_P8{{选择开发环境}}
            
            subgraph S3_Dev_Online [3.2.1 在线IDE开发]
                direction TB
                S3_Dev_P8 --> S3_Dev_Online_P1[选择 "在线IDE"]
                S3_Dev_Online_P1 --> S3_Dev_Online_P2{{系统: 动态创建隔离的开发容器}}
                S3_Dev_Online_P2 --> S3_Dev_Online_P3(自动clone项目代码)
                S3_Dev_Online_P3 --> S3_Dev_Online_P4[在浏览器中加载VSCode界面]
                S3_Dev_Online_P4 --> S3_Dev_Online_P5{{进行编码...}}
                S3_Dev_Online_P5 --> S3_Dev_Online_P6{使用平台AI工具?}
                S3_Dev_Online_P6 -- Yes --> S3_Dev_Online_P7(e.g., "帮我重构这段代码")
                S3_Dev_Online_P7 --> S3_Dev_Online_P8{{AI服务: 执行请求}}
                S3_Dev_Online_P8 --> S3_Dev_Online_P9[(从开发者账户预付费点数中扣费)]
                S3_Dev_Online_P9 --> S3_Dev_Online_P5
                S3_Dev_Online_P6 -- No --> S3_Dev_Online_P5
                S3_Dev_Online_P5 --> S3_Dev_Online_P10[完成编码, 在IDE内提交代码]
                S3_Dev_Online_P10 --> S3_Dev_End(代码提交至Git仓库)
            end

            subgraph S3_Dev_Local [3.2.2 本地开发]
                direction TB
                S3_Dev_P8 --> S3_Dev_Local_P1[选择 "本地开发"]
                S3_Dev_Local_P1 --> S3_Dev_Local_P2[提交本地开发申请]
                S3_Dev_Local_P2 --> S3_Dev_Local_P3[签署《本地开发环境承诺书》]
                S3_Dev_Local_P3 --> S3_Dev_Local_P4[缴纳额外保证金]
                S3_Dev_Local_P4 --> S3_Dev_Local_P5{审核通过?}
                S3_Dev_Local_P5 -- No --> S3_Dev_Local_P1
                S3_Dev_Local_P5 -- Yes --> S3_Dev_Local_P6{{系统: 生成临时的Git授权Token}}
                S3_Dev_Local_P6 --> S3_Dev_Local_P7[开发者: 在本地配置环境并clone代码]
                S3_Dev_Local_P7 --> S3_Dev_Local_P8{{在本地IDE中编码...}}
                S3_Dev_Local_P8 --> S3_Dev_Local_P9[完成编码, 使用Git推送到远程仓库]
                S3_Dev_Local_P9 --> S3_Dev_End
            end
        end

        subgraph S3_Submit [3.3 代码提交与合并流程]
            direction TB
            S3_Submit_Start(开发者推送代码) --> S3_Submit_P1[在平台创建合并请求(MR)]
            S3_Submit_P1 --> S3_Submit_P2{{系统: 触发CI/CD Pipeline}}
            S3_Submit_P2 --> S3_Submit_P3(1. 自动构建)
            S3_Submit_P3 --> S3_Submit_P4(2. 运行单元测试)
            S3_Submit_P4 --> S3_Submit_P5(3. 代码风格检查 Linter)
            S3_Submit_P5 --> S3_Submit_P6(4. 安全漏洞扫描)
            S3_Submit_P6 --> S3_Submit_P7{自动化检查全部通过?}
            S3_Submit_P7 -- No --> S3_Submit_P8[通知开发者修复问题] --> S3_Submit_Start
            S3_Submit_P7 -- Yes --> S3_Submit_P9[MR状态更新: 等待审核]
            S3_Submit_P9 --> S3_Submit_P10{{系统: 通知相关框架师}}
            S3_Submit_P10 --> S3_Submit_P11[[框架师]]
            S3_Submit_P11 --> S3_Submit_P12[审查代码变更]
            S3_Submit_P12 --> S3_Submit_P13{代码质量是否合格?}
            S3_Submit_P13 -- No --> S3_Submit_P14[提出修改意见, 驳回MR] --> S3_Submit_Start
            S3_Submit_P13 -- Yes --> S3_Submit_P15{选择合并方式}
            S3_Submit_P15 -- 手动合并 --> S3_Submit_P16[框架师手动执行Git合并]
            S3_Submit_P15 -- AI合并 --> S3_Submit_P17{{AI: 尝试智能合并代码}}
            S3_Submit_P17 --> S3_Submit_P18(使用框架师的AI额度)
            S3_Submit_P17 --> S3_Submit_P19{AI合并有无冲突?}
            S3_Submit_P19 -- Yes --> S3_Submit_P20[通知框架师手动解决冲突] --> S3_Submit_P16
            S3_Submit_P19 -- No --> S3_Submit_P21(AI自动完成合并)
            S3_Submit_P16 --> S3_Submit_P22(合并完成)
            S3_Submit_P21 --> S3_Submit_P22
            S3_Submit_P22 --> S3_Submit_P23[(更新任务状态为"已完成", 等待点评)]
            S3_Submit_P23 --> S3_Submit_End(流程结束)
        end
    end

    %% Section 4: Continuous Interaction and Monitoring
    subgraph S4 [第四部分: 持续交互与监控]
        direction TB

        subgraph S4_Arch [4.1 框架师的监控与管理]
            direction TB
            S4_Arch_Start[[框架师]] --> S4_Arch_P1[访问项目仪表盘]
            S4_Arch_P1 --> S4_Arch_P2{{1. 进度监控}}
            S4_Arch_P2 --> S4_Arch_P3(查看任务看板/甘特图)
            S4_Arch_P3 --> S4_Arch_P4(识别延期风险)
            S4_Arch_P1 --> S4_Arch_P5{{2. 代码质量抽查}}
            S4_Arch_P5 --> S4_Arch_P6(随机检查开发者的提交)
            S4_Arch_P6 --> S4_Arch_P7(对代码进行评分和评论)
            S4_Arch_P7 --> S4_Arch_P8[(评分计入开发者档案)]
            S4_Arch_P1 --> S4_Arch_P9{{3. 在线IDE监察}}
            S4_Arch_P9 --> S4_Arch_P10[查看在线IDE活动日志]
            S4_Arch_P10 --> S4_Arch_P11{是否满足最低使用要求?}
            S4_Arch_P11 -- No --> S4_Arch_P12[向开发者发出警告]
            S4_Arch_P1 --> S4_Arch_P13{{4. 文档维护}}
            S4_Arch_P13 --> S4_Arch_P14(根据开发进展更新技术文档)
        end

        subgraph S4_Client [4.2 客户的项目交互]
            direction TB
            S4_Client_Start[[客户]] --> S4_Client_P1[访问我的项目页面]
            S4_Client_P1 --> S4_Client_P2{{1. 查看进度}}
            S4_Client_P2 --> S4_Client_P3(查看实时进度报告)
            S4_Client_P3 --> S4_Client_P4(在节点完成后进行点评)
            S4_Client_P1 --> S4_Client_P5{{2. 支付与款项}}
            S4_Client_P5 --> S4_Client_P6(按里程碑支付进度款)
            S4_Client_P6 --> S4_Client_P7(为优秀开发者发奖金)
            S4_Client_P7 --> S4_Client_P8(项目完成, 结清尾款)
            S4_Client_P1 --> S4_Client_P9{{3. 需求变更}}
            S4_Client_P9 --> S4_Client_P10[提交需求变更请求]
            S4_Client_P10 --> S4_Client_P11{{系统: 通知框架师评估影响}}
            S4_Client_P11 --> S4_Client_P12(客户确认额外费用后继续)
            S4_Client_P1 --> S4_Client_P13{{4. 人员与项目管理}}
            S4_Client_P13 --> S4_Client_P14[申请更换不满意的开发者]
            S4_Client_P14 --> S4_Client_P15[终止项目(需支付违约金)]
        end

        subgraph S4_Dev [4.3 开发者的交互与申诉]
            direction TB
            S4_Dev_Start[[开发者]] --> S4_Dev_P1[访问我的任务页面]
            S4_Dev_P1 --> S4_Dev_P2{{1. 沟通与建议}}
            S4_Dev_P2 --> S4_Dev_P3(向框架师提出代码修改建议)
            S4_Dev_P3 --> S4_Dev_P4(对开发文档提出更新意见)
            S4_Dev_P1 --> S4_Dev_P5{{2. 申诉与投诉}}
            S4_Dev_P5 --> S4_Dev_P6[对框架师的评分过低提出申诉]
            S4_Dev_P6 --> S4_Dev_P7{{系统: 将申诉转给公司管理或中立点评者}}
            S4_Dev_P5 --> S4_Dev_P8[向平台投诉框架师或客户的不当行为]
        end

        subgraph S4_Reviewer [4.4 点评者的质量评估]
            direction TB
            S4_Reviewer_Start[[点评者]] --> S4_Reviewer_P1{{系统: 推送已完成的代码片段}}
            S4_Reviewer_P1 --> S4_Reviewer_P2[点评者打开点评任务]
            S4_Reviewer_P2 --> S4_Reviewer_P3(从代码可读性, 效率, 规范性等多维度评分)
            S4_Reviewer_P3 --> S4_Reviewer_P4[(提交评分, 计入代码的最终质量分)]
        end

    end

    %% Section 5: Platform-wide Features
    subgraph S5 [第五部分: 平台级功能]
        direction TB
        S5_P1((任务大厅)) --> S5_P2(展示所有公开任务)
        S5_P2 --> S5_P3(提供筛选和搜索功能)
        S5_P1 --> S3_Dev_P1

        S5_P4((全平台通知系统)) --> S5_P5(项目进度更新时, 向所有关注者推送)
        S5_P5 --> S5_P6(任务完成/点评时, 进行推送)
        S5_P4 --> S4_Client_Start
        S5_P4 --> S4_Arch_Start
        S5_P4 --> S4_Dev_Start

        S5_P7((平台统一AI架构)) --> S2_AI_P1
        S5_P7 --> S3_Submit_P17
        S5_P7 --> S3_Dev_Online_P8

        S5_P8((虚拟化开发环境平台)) --> S3_Dev_Online_P2
    end

    %% Global Connections
    S1_Client_End --> S2_Submit_Start
    S2_Confirm_End --> S3_Assign_Start
    S3_Assign_End --> S3_Dev_Start
    S3_Dev_End --> S3_Submit_Start
    S3_Submit_End --> S4_Reviewer_Start

```
