use anyhow::Result;
use rmcp::{Error as McpError, model::*};

use super::{MemoryManager, MemoryCategory};
use crate::mcp::{JiyiRequest, utils::{validate_project_path, project_path_error}};

/// 全局记忆管理工具
///
/// 用于存储和管理重要的开发规范、用户偏好和最佳实践
#[derive(Clone)]
pub struct MemoryTool;

impl MemoryTool {
    pub async fn jiyi(
        request: JiyiRequest,
    ) -> Result<CallToolResult, McpError> {
        // 使用增强的路径验证功能
        if let Err(e) = validate_project_path(&request.project_path) {
            return Err(project_path_error(format!(
                "路径验证失败: {}\n原始路径: {}\n请检查路径格式是否正确，特别是 Windows 路径应使用正确的盘符格式（如 C:\\path）",
                e,
                request.project_path
            )).into());
        }

        let manager = MemoryManager::new(&request.project_path)
            .map_err(|e| McpError::internal_error(format!("Failed to create memory manager: {}", e), None))?;

        let result = match request.action.as_str() {
            "memory" => {
                if request.content.trim().is_empty() {
                    return Err(McpError::invalid_params("Missing memory content".to_string(), None));
                }

                let category = match request.category.as_str() {
                    "rule" => MemoryCategory::Rule,
                    "preference" => MemoryCategory::Preference,
                    "pattern" => MemoryCategory::Pattern,
                    "context" => MemoryCategory::Context,
                    _ => MemoryCategory::Context,
                };

                let id = manager.add_memory(&request.content, category)
                    .map_err(|e| McpError::internal_error(format!("Failed to add memory: {}", e), None))?;

                format!("Memory added successfully, ID: {}\nContent: {}\nCategory: {:?}", id, request.content, category)
            }
            "recall" => {
                manager.get_project_info()
                    .map_err(|e| McpError::internal_error(format!("Failed to get project info: {}", e), None))?
            }
            _ => {
                return Err(McpError::invalid_params(
                    format!("Unknown action type: {}", request.action),
                    None
                ));
            }
        };

        Ok(CallToolResult::success(vec![Content::text(result)]))
    }
}
