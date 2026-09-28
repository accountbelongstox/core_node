# SSO Authentication Usage Guide

**Setup**: Persist `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, and `WORKOS_CLIENT_SECRET` through `RuntimeConfigurationStore`; the start Shell loads them before Laravel starts.  
**Login**: Use username/password tab to authenticate, then click "Sign in with SSO" to get SSO URL.  
**Usage**: Copy SSO URL and share it - logged in users will auto-authenticate, others will see login prompt.
