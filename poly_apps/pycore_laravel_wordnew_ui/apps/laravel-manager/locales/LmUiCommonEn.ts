/** Laravel Manager translation resource fragment (uiCommon). */
export const lmEnUiCommon = {
  uiCommon: {
    html_error: {
      title: "HTML Error Response",
      status_unknown: "HTTP (unknown)",
      no_url: "(no url)",
      copy_url: "Copy URL",
      copy_html: "Copy HTML",
      preview: "Preview",
      source: "Source",
      sandbox_note: "Scripts are disabled in preview (sandboxed).",
      empty_badge: "EMPTY",
      no_content: "No HTML content captured.",
      preview_title: "HTML Error Preview"
    },
    clipboard: {
      copied: "Copied to clipboard",
      copied_items: "Copied {{count}} items",
      copy_failed_manual: "Failed to copy. Please copy manually.",
      copy_failed: "Failed to copy",
      copy_to_clipboard: "Copy to clipboard",
      copy_all: "Copy All"
    },
    dashboard: {
      module_not_initialized: "Module Not Initialized"
    },
    dropzone: {
      default_label: "Drop files here or click to upload"
    },
    text_input: {
      characters: "{{count}} characters"
    },
    confirm_modal: {
      title: "Confirm",
      confirm: "Confirm",
      processing: "Processing..."
    },
    data_table: {
      no_data: "No data available",
      showing: "Showing {{start}} to {{end}} of {{total}} results",
      rows_per_page: "Rows per page:",
      first: "First",
      previous: "Previous",
      next: "Next",
      last: "Last",
      page_of: "Page {{page}} of {{total}}",
      search_placeholder: "Search...",
      export: "Export"
    },
    requests: {
      request_failed: "Request failed",
      unknown_error: "Unknown error occurred",
      operation_failed: "Operation failed",
      fetch_failed: "Failed to fetch data",
      execution_failed: "Execution failed",
      invalid_input: "Invalid input",
      no_feature_info: "No feature information available"
    },
    auth: {
      registration_failed: "Registration failed",
      logout_failed: "Logout failed",
      update_preferences_failed: "Failed to update preferences",
      invalid_response: "Invalid response format"
    },
    tool_model: {
      validation_failed: "Validation failed: {{errors}}",
      api_method_not_found: "API method not found: {{method}}",
      api_request_failed: "API request failed",
      field_required: "Field '{{field}}' is required"
    },
    media: {
      source_files: "Static Resources",
      source_code: "Code",
      viewer_boundary: {
        viewer_failed: "This viewer failed to load.",
        download: "Download"
      },
      upload_card: {
        title: "Uploading",
        dismiss: "Dismiss",
        progress: "{{done}}/{{total}} done",
        progress_failed: "{{done}}/{{total}} done · {{failed}} failed"
      },
      epub: {
        open_failed: "Failed to open this book.",
        prev_page: "Previous page",
        next_page: "Next page"
      },
      source_list: {
        sentences_short: "{{count}} sent.",
        segments_short: "{{count}} seg.",
        login_required: "Login required to browse {{kind}}."
      },
      source_detail: {
        play_sentence_audio: "Play sentence audio",
        ai_details: "AI details"
      },
      file_tree: {
        root: "(root)",
        no_file_saved: "No file was saved by the server.",
        upload_failed_summary: "{{failures}} of {{total}} file(s) failed to upload.",
        target: "Target: {{path}}",
        upload: "Upload",
        login_to_upload: "Login to upload",
        upload_hint: "Upload files or a folder",
        upload_login_required: "Login required to upload",
        new_folder: "New Folder",
        new_folder_hint: "Create folder in target",
        login_required: "Login required",
        login_required_browse: "Login required to browse {{name}}.",
        no_files: "No files found",
        rename: "Rename",
        download: "Download",
        delete: "Delete",
        upload_modal: {
          title: "Upload Resources",
          drop_hint: "Drag & drop files here, or click to browse",
          drop_sub: "Files upload into the selected target directory",
          select_files: "Select Files",
          select_folder: "Select Folder"
        },
        new_folder_modal: {
          in_path: "In: {{path}}",
          name_placeholder: "folder name",
          create: "Create"
        },
        delete_modal: {
          title_folder: "Delete Folder",
          title_file: "Delete File",
          confirm: "Delete <hl>{{name}}</hl>?",
          computing: "Computing impact…",
          impact: "This will remove <hl>{{files}}</hl> file(s) and <hl>{{directories}}</hl> director(ies) (<hl>{{total}}</hl> total). This cannot be undone.",
          irreversible: "This cannot be undone."
        }
      },
      viewer: {
        preview: "Preview",
        no_content: "No content",
        code_editor_failed: "The code editor could not be loaded.",
        book_reader_failed: "The book reader could not be loaded.",
        no_file_selected: "No file selected",
        prev_episode: "Previous Episode",
        next_episode: "Next Episode",
        skip_intro: "Skip Intro",
        no_inline_preview: "No inline preview available",
        download: "Download",
        save: "Save",
        edit: "Edit",
        unsaved_changes: "Unsaved changes",
        name_label: "Name:",
        size_label: "Size:",
        type_label: "Type:",
        not_available: "N/A",
        unknown: "unknown",
        auto_play_next: "Auto-play next ({{count}} in queue)",
        show_floating_controls: "Show floating episode controls",
        auto_skip_intro: "Auto-skip intro",
        start_label: "Start:",
        end_label: "End:",
        seconds_unit: "sec",
        skip_range: "Skip intro from {{start}}s to {{end}}s"
      }
    }
  }
} as const;
