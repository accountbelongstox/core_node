#!/bin/bash
# [#] Setup Network Router: opens the NAT gateway menu (quick install, relay
# ports, uplink, restart/stop, logs). The same menu is the `natgateway` command.
manage_natgateway() {
    local natgateway_script="$CORE_NODE_ROOT_DIR/scripts/shells/linux/debian/install_shells/113_natgateway.sh"
    bash "$natgateway_script" menu
}
