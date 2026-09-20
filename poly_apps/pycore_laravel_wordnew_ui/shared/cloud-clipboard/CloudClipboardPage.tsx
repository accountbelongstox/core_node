import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CLOUD_CLIPBOARD } from '../../core/contracts/CloudClipboardContract';
import CloudClipboardPanel from './CloudClipboardPanel';
import { readCloudClipboardNamespace } from './CloudClipboardNavigation';

export default function CloudClipboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const namespace = readCloudClipboardNamespace(location);
  const changeNamespace = (value: string): void => {
    const params = new URLSearchParams(location.search);
    if (value) params.set(CLOUD_CLIPBOARD.namespace_query, value);
    else params.delete(CLOUD_CLIPBOARD.namespace_query);
    navigate({ pathname: location.pathname, search: params.toString(), hash: location.hash });
  };

  return <CloudClipboardPanel namespace={namespace} onNamespaceChange={changeNamespace} />;
}
