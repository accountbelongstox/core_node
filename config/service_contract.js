const fs = require('fs');
const path = require('path');

const SERVICE_CONTRACT_PATH = path.join(__dirname, 'service_contract.json');
const SERVICE_CONTRACT = JSON.parse(fs.readFileSync(SERVICE_CONTRACT_PATH, 'utf8'));

function value(contractPath) {
  const segments = contractPath.split('.');
  let current = SERVICE_CONTRACT;

  for (const segment of segments) {
    current = current && Object.prototype.hasOwnProperty.call(current, segment)
      ? current[segment]
      : undefined;
  }

  if (current === undefined || current === null) {
    throw new Error(`Unknown service contract value: ${contractPath}`);
  }

  return current;
}

function host(name) {
  return String(value(`hosts.${name}`));
}

function port(name) {
  const resolvedPort = value(`ports.${name}`);

  if (!Number.isInteger(resolvedPort) || resolvedPort < 1) {
    throw new Error(`Invalid service contract port: ${name}`);
  }

  return resolvedPort;
}

function rootDomain(index = 0) {
  const domains = value('access.root_domains');
  const resolvedDomain = Array.isArray(domains) ? domains[index] : undefined;

  if (typeof resolvedDomain !== 'string' || resolvedDomain.length === 0) {
    throw new Error(`Invalid service contract root domain index: ${index}`);
  }

  return resolvedDomain;
}

function serviceDomain(name, replacements = {}, rootDomainIndex = 0) {
  const labels = value(`access.service_domains.${name}`);
  const resolvedLabels = Array.isArray(labels)
    ? labels.map((label) => String(label).replace(/^\{(.+)\}$/, (_, key) => replacements[key] || value(`access.default_api_region_prefix`)))
    : [];

  if (resolvedLabels.length === 0 || resolvedLabels.some((label) => label.length === 0)) {
    throw new Error(`Invalid service contract domain: ${name}`);
  }

  return [...resolvedLabels, rootDomain(rootDomainIndex)].join('.');
}

function url(protocol, hostname, portNumber, pathname = '') {
  const portPart = portNumber ? `:${portNumber}` : '';
  const pathPart = pathname && !pathname.startsWith('/') ? `/${pathname}` : pathname;

  return `${protocol}://${hostname}${portPart}${pathPart}`;
}

module.exports = {
  document: SERVICE_CONTRACT,
  host,
  port,
  rootDomain,
  serviceDomain,
  url,
  value,
};
