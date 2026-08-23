import React from 'react';
import { Route } from 'react-router-dom';

export interface AppRouteElementDefinition {
  key: React.Key;
  element: React.ReactNode;
  path?: string;
  index?: boolean;
}

const RegistryRoute = Route as unknown as React.ComponentType<{
  key?: React.Key;
  path?: string;
  index?: boolean;
  element?: React.ReactNode;
}>;

export function createAppRouteElements(
  definitions: AppRouteElementDefinition[],
): React.ReactElement[] {
  return definitions.map((definition) => (
    <RegistryRoute
      key={definition.key}
      path={definition.path}
      index={definition.index}
      element={definition.element}
    />
  ));
}
