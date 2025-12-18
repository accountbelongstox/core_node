#!/bin/bash
# Reload Octane server
echo "Reloading Octane server..."
kill -USR2 1872723
echo "Signal sent. Octane will reload in a few seconds."
