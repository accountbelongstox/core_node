// Barrel: re-exports split data modules so existing `import ... from "./constants"` keeps working.
export * from "./app_data/translations";
export * from "./app_data/toolsData";
export * from "./app_data/mockData";
import { API_ENDPOINTS } from "./endpoints";
export { API_ENDPOINTS };
