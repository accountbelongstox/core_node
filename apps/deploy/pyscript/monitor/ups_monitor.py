import json
from pycore.utils_linux import plattools, http


class UPS:
    def __init__(self):
        self.command_prefix = ['upsc']

    def ping_subnet_and_check_network(self):
        subnet = '192.168.100'
        ping_results = http.ping_subnet(subnet, addips=['192.168.2.1'])
        reachable_ips = [ip for ip, reachable in ping_results.items() if reachable]
        is_network_up = len(reachable_ips) >= 2
        return {"reachable_ips": reachable_ips, "is_network_up": is_network_up}

    def get_ups_names(self):
        try:
            command = self.command_prefix + ['-l']
            result = plattools.exec_cmd(command)
            ups_names = [item.strip() for item in result.strip().split('\n')]
            return ups_names
        except Exception as e:
            print(f"An error occurred while fetching UPS names: {e}")
            return []

    def get_ups_status(self, ups_name):
        try:
            command = self.command_prefix + [f'{ups_name} ups.status']
            result = plattools.exec_cmd(command).strip()
            if result.startswith("OL"):
                return "ON"
            elif result.startswith("OB"):
                return "OFF"
            else:
                return f"Unknown status format: {result}"
        except Exception as e:
            print(f"An error occurred while fetching status for UPS {ups_name}: {e}")
            return f"Unknown:{e}"

    def get_battery_charge(self, ups_name=None):
        if not ups_name:
            ups_names = self.get_ups_names()
            ups_name = ups_names[0]
        try:
            command = self.command_prefix + [f'{ups_name} battery.charge']
            result = plattools.exec_cmd(command)
            charge = int(result.strip())  # Convert the result to an integer after stripping whitespace
            return charge
        except Exception as e:
            print(f"An error occurred while fetching battery charge for UPS {ups_name}: {e}")
            return 101


    def get_ups_info(self, ups_name):
        try:
            command = self.command_prefix + [f'{ups_name}']
            result = plattools.exec_cmd(command)

            # Process the result
            infos = [item.strip() for item in result.strip().split('\n')]
            info_dict = {}

            for info in infos:
                if ':' in info:
                    key, value = map(str.strip, info.split(':', 1))
                    info_dict[key] = value

            return info_dict
        except Exception as e:
            print(f"An error occurred while fetching status for UPS {ups_name}: {e}")
            return {"error": f"{e}"}

    def get_all_ups_info(self):
        try:
            ups_names = self.get_ups_names()
            if isinstance(ups_names, str):
                return {"error": "Failed to retrieve UPS names."}

            all_ups_info = {}
            for ups_name in ups_names:
                all_ups_info[ups_name] = self.get_ups_info(ups_name)

            return all_ups_info
        except Exception as e:
            print(f"An error occurred while fetching information for all UPS: {e}")
            return {"error": f"{e}"}

    def get_overall_ups_status(self):
        default_battery = 101
        ups_names = self.get_ups_names()
        for ups_name in ups_names:
            status = self.get_ups_status(ups_name).strip()
            battery = self.get_battery_charge(ups_name)
            return f"{status} {battery}"
        return f"None {default_battery}"

    def get_full_ups_info(self, ups_name=None):
        if not ups_name:
            ups_names = self.get_ups_names()
            ups_name = ups_names[0]
        try:
            command = self.command_prefix + [ups_name]
            result = plattools.exec_cmd(command)
            return result
        except Exception as e:
            print(f"An error occurred while fetching full info for UPS {ups_name}: {e}")
            return f"Error: {e}"

ups = UPS()
