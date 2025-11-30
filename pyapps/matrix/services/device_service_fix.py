# 将此代码替换到 device_service.py 的 list_devices 方法（第85-93行）

async def list_devices(self) -> List[ADBDevice]:
    """
    List all ADB devices with detailed information

    Returns:
        Device list with model and product info
    """
    # Get basic device list
    devices = await self.device_manager.list_devices(self.adb_path)

    # Enhance with detailed info for available devices
    enhanced_devices = []
    for device in devices:
        if device.is_available:
            try:
                # Get detailed device info (model, product)
                detailed_device = ADBManager.get_device_info(device.serial, self.adb_path)
                enhanced_devices.append(detailed_device)
            except Exception as e:
                print(f"[DeviceService] Failed to get info for {device.serial}: {e}")
                # Fallback to basic device info
                enhanced_devices.append(device)
        else:
            # For offline/unauthorized devices, keep basic info
            enhanced_devices.append(device)

    return enhanced_devices
