import serviceContract from '../../../../../config/service_contract.json';

export const DEFAULT_SERVER_PORT: number = serviceContract.ports.mcp_chrome;
export const HOST_NAME: string = serviceContract.mcp_chrome.native_host_name;
export const EXTENSION_ID: string = serviceContract.mcp_chrome.extension_id;
export const FIREFOX_EXTENSION_ID: string = serviceContract.mcp_chrome.firefox_extension_id;
