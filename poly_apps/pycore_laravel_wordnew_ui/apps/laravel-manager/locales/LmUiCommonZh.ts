/** Laravel Manager translation resource fragment (uiCommon). */
export const lmZhUiCommon = {
  uiCommon: {
    html_error: {
      title: "HTML 错误响应",
      status_unknown: "HTTP（未知）",
      no_url: "（无 URL）",
      copy_url: "复制 URL",
      copy_html: "复制 HTML",
      preview: "预览",
      source: "源码",
      sandbox_note: "预览中已禁用脚本（沙箱隔离）。",
      empty_badge: "空",
      no_content: "未捕获到 HTML 内容。",
      preview_title: "HTML 错误预览"
    },
    clipboard: {
      copied: "已复制到剪贴板",
      copied_items: "已复制 {{count}} 项",
      copy_failed_manual: "复制失败，请手动复制。",
      copy_failed: "复制失败",
      copy_to_clipboard: "复制到剪贴板",
      copy_all: "全部复制"
    },
    dashboard: {
      module_not_initialized: "模块未初始化"
    },
    dropzone: {
      default_label: "将文件拖到此处或点击上传"
    },
    text_input: {
      characters: "{{count}} 个字符"
    },
    confirm_modal: {
      title: "确认",
      confirm: "确认",
      processing: "处理中..."
    },
    data_table: {
      no_data: "暂无数据",
      showing: "显示第 {{start}} 至 {{end}} 条，共 {{total}} 条结果",
      rows_per_page: "每页行数：",
      first: "首页",
      previous: "上一页",
      next: "下一页",
      last: "末页",
      page_of: "第 {{page}} / {{total}} 页",
      search_placeholder: "搜索...",
      export: "导出"
    },
    requests: {
      request_failed: "请求失败",
      unknown_error: "发生未知错误",
      operation_failed: "操作失败",
      fetch_failed: "获取数据失败",
      execution_failed: "执行失败",
      invalid_input: "输入无效",
      no_feature_info: "暂无功能信息"
    },
    auth: {
      registration_failed: "注册失败",
      logout_failed: "退出登录失败",
      update_preferences_failed: "更新偏好设置失败",
      invalid_response: "响应格式无效"
    },
    tool_model: {
      validation_failed: "校验失败：{{errors}}",
      api_method_not_found: "未找到 API 方法：{{method}}",
      api_request_failed: "API 请求失败",
      field_required: "字段“{{field}}”为必填项"
    },
    media: {
      source_files: "静态资源",
      source_code: "代码",
      viewer_boundary: {
        viewer_failed: "此查看器加载失败。",
        download: "下载"
      },
      upload_card: {
        title: "上传中",
        dismiss: "关闭",
        progress: "已完成 {{done}}/{{total}}",
        progress_failed: "已完成 {{done}}/{{total}} · 失败 {{failed}}"
      },
      epub: {
        open_failed: "无法打开这本书。",
        prev_page: "上一页",
        next_page: "下一页"
      },
      source_list: {
        sentences_short: "{{count}} 句",
        segments_short: "{{count}} 段",
        login_required: "登录后才能浏览{{kind}}。"
      },
      source_detail: {
        play_sentence_audio: "播放句子音频",
        ai_details: "AI 详情"
      },
      file_tree: {
        root: "（根目录）",
        no_file_saved: "服务器未保存任何文件。",
        upload_failed_summary: "{{total}} 个文件中有 {{failures}} 个上传失败。",
        target: "目标：{{path}}",
        upload: "上传",
        login_to_upload: "登录后上传",
        upload_hint: "上传文件或文件夹",
        upload_login_required: "登录后才能上传",
        new_folder: "新建文件夹",
        new_folder_hint: "在目标目录中创建文件夹",
        login_required: "需要登录",
        login_required_browse: "登录后才能浏览{{name}}。",
        no_files: "未找到文件",
        rename: "重命名",
        download: "下载",
        delete: "删除",
        upload_modal: {
          title: "上传资源",
          drop_hint: "将文件拖到此处，或点击浏览",
          drop_sub: "文件将上传到所选的目标目录",
          select_files: "选择文件",
          select_folder: "选择文件夹"
        },
        new_folder_modal: {
          in_path: "位置：{{path}}",
          name_placeholder: "文件夹名称",
          create: "创建"
        },
        delete_modal: {
          title_folder: "删除文件夹",
          title_file: "删除文件",
          confirm: "删除 <hl>{{name}}</hl>？",
          computing: "正在计算影响范围…",
          impact: "这将删除 <hl>{{files}}</hl> 个文件和 <hl>{{directories}}</hl> 个目录（共 <hl>{{total}}</hl> 项），且无法撤销。",
          irreversible: "此操作无法撤销。"
        }
      },
      viewer: {
        preview: "预览",
        no_content: "暂无内容",
        code_editor_failed: "无法加载代码编辑器。",
        book_reader_failed: "无法加载电子书阅读器。",
        no_file_selected: "未选择文件",
        prev_episode: "上一集",
        next_episode: "下一集",
        skip_intro: "跳过片头",
        no_inline_preview: "无法内联预览",
        download: "下载",
        save: "保存",
        edit: "编辑",
        unsaved_changes: "有未保存的更改",
        name_label: "名称：",
        size_label: "大小：",
        type_label: "类型：",
        not_available: "无",
        unknown: "未知",
        auto_play_next: "自动播放下一个（队列中 {{count}} 个）",
        show_floating_controls: "显示悬浮选集控件",
        auto_skip_intro: "自动跳过片头",
        start_label: "开始：",
        end_label: "结束：",
        seconds_unit: "秒",
        skip_range: "跳过 {{start}} 秒至 {{end}} 秒的片头"
      }
    }
  }
} as const;
