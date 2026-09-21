import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CLOUD_CLIPBOARD } from '../../../core/contracts/CloudClipboardContract';
import { useShell } from '../../../shell/ShellContext';
import { END_META } from '../../../shell/shellTypes';
import { readCloudClipboardNamespace } from '../../../shared/cloud-clipboard/CloudClipboardNavigation';

export const PcCloudClipboardRedirect: React.FC = () => {
  const location = useLocation();
  const { setClipboard } = useShell();
  const params = new URLSearchParams(location.search);
  const namespace = readCloudClipboardNamespace(location);
  const validNamespace = !namespace || new RegExp(CLOUD_CLIPBOARD.namespace_pattern).test(namespace);
  params.delete(CLOUD_CLIPBOARD.namespace_query);

  useEffect(() => {
    setClipboard({ open: true, collapsed: false, namespace: validNamespace ? namespace : '' });
  }, [namespace, validNamespace, setClipboard]);

  return <Navigate to={{ pathname: END_META['pycore-manager'].path, search: params.toString() }} replace />;
};
