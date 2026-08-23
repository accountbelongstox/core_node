(function (globalObject, factory) {
  const isCommonJs = typeof module === 'object' && typeof module.exports === 'object';
  const contractDocument = isCommonJs
    ? require('../../../config/service_contract.json')
    : JSON.parse(GM_getResourceText('coreNodeServiceContract'));
  const adapter = factory(contractDocument);

  if (isCommonJs) {
    module.exports = adapter;
  } else {
    globalObject.CoreNodeServiceContract = adapter;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (contractDocument) {
  function host(name) {
    return contractDocument.hosts[name];
  }

  function port(name) {
    return contractDocument.ports[name];
  }

  function serviceDomain(name, replacements = {}, rootDomainIndex = 0) {
    const defaultRegion = contractDocument.access.default_api_region_prefix;
    const labels = contractDocument.access.service_domains[name];
    const resolvedLabels = labels.map((label) => {
      const match = /^\{(.+)\}$/.exec(label);
      return match ? replacements[match[1]] || defaultRegion : label;
    });

    return [...resolvedLabels, contractDocument.access.root_domains[rootDomainIndex]].join('.');
  }

  function url(protocol, hostname, portNumber, pathname = '') {
    const portPart = portNumber ? `:${portNumber}` : '';
    const pathPart = pathname && !pathname.startsWith('/') ? `/${pathname}` : pathname;
    return `${protocol}://${hostname}${portPart}${pathPart}`;
  }

  function matchesRootDomain(hostname) {
    return contractDocument.access.root_domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  }

  return { document: contractDocument, host, matchesRootDomain, port, serviceDomain, url };
});
