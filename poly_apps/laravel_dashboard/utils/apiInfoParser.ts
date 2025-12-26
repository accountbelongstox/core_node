import { ApiInfoEndpoint, ApiInfoParsedEndpoint, ApiInfoParam, ApiInfoResponse } from '../types';

/**
 * Parse feature string format:
 * auth_type/method|description|controller|params:param_list|response:response_list|tags:tag_list
 *
 * Param format: name(type,requirement,example)
 * Response format: name(type,description)
 */
export const parseFeatureString = (endpoint: ApiInfoEndpoint, index: number): ApiInfoParsedEndpoint => {
  const { path, feature } = endpoint;

  if (!feature || typeof feature !== 'string') {
    return {
      id: `api_${index}`,
      path,
      method: 'GET',
      authType: 'unknown',
      description: 'No feature information available',
      controller: 'unknown'
    };
  }

  const parts = feature.split('|');

  const authMethod = parts[0] || '';
  const [authType, method] = authMethod.split('/');
  const description = parts[1] || '';
  const controller = parts[2] || '';

  const parsed: ApiInfoParsedEndpoint = {
    id: `api_${index}`,
    path,
    method: method || 'GET',
    authType: authType || 'auth_required',
    description,
    controller
  };

  for (let i = 3; i < parts.length; i++) {
    const part = parts[i];

    if (part.startsWith('params:')) {
      parsed.params = parseParams(part.substring(7));
    } else if (part.startsWith('response:')) {
      parsed.response = parseResponse(part.substring(9));
    } else if (part.startsWith('tags:')) {
      parsed.tags = part.substring(5).split(',').map(t => t.trim());
    } else if (part.startsWith('headers:')) {
      const headerNames = part.substring(8).split(',').map(h => h.trim());
      parsed.headers = headerNames.map(name => ({ name }));
    }
  }

  return parsed;
};

const parseParams = (paramString: string): ApiInfoParam[] => {
  if (!paramString) return [];

  const params: ApiInfoParam[] = [];
  const regex = /(\w+)\(([^)]+)\)/g;
  let match;

  while ((match = regex.exec(paramString)) !== null) {
    const name = match[1];
    const details = match[2].split(',').map(s => s.trim());

    params.push({
      name,
      type: details[0] || 'string',
      requirement: (details[1] === 'required' || details[1] === 'optional')
        ? details[1]
        : 'optional',
      example: details[2]
    });
  }

  return params;
};

const parseResponse = (responseString: string): ApiInfoResponse[] => {
  if (!responseString) return [];

  const responses: ApiInfoResponse[] = [];
  const regex = /(\w+)\(([^)]+)\)/g;
  let match;

  while ((match = regex.exec(responseString)) !== null) {
    const name = match[1];
    const details = match[2].split(',').map(s => s.trim());

    responses.push({
      name,
      type: details[0] || 'string',
      description: details[1]
    });
  }

  return responses;
};

export const generateExampleParams = (params?: ApiInfoParam[]): Record<string, any> => {
  if (!params || params.length === 0) return {};

  const example: Record<string, any> = {};

  params.forEach(param => {
    if (param.example !== undefined) {
      example[param.name] = param.example;
    } else {
      switch (param.type) {
        case 'int':
        case 'integer':
        case 'numeric':
          example[param.name] = 0;
          break;
        case 'boolean':
          example[param.name] = false;
          break;
        case 'array':
          example[param.name] = [];
          break;
        case 'object':
          example[param.name] = {};
          break;
        default:
          example[param.name] = '';
      }
    }
  });

  return example;
};
