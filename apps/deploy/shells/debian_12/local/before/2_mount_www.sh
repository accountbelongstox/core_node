SOURCE_DIR="/mnt/d/programing"
TARGET_DIR="/www"
TARGET_SUBDIR="$TARGET_DIR/wwwroot"

sudo grep -q "$SOURCE_DIR" /etc/fstab
if [ $? -ne 0 ]; then
  echo "$SOURCE_DIR not found in /etc/fstab"
else
  echo "$SOURCE_DIR is already in /etc/fstab"
  exit 0
fi

sudo mount | grep -q "$TARGET_SUBDIR"
if [ $? -ne 0 ]; then
  echo "$TARGET_SUBDIR is not currently mounted"
else
  echo "$TARGET_SUBDIR is already mounted"
  exit 0
fi

if [ ! -d "$TARGET_DIR" ]; then
  echo "Creating $TARGET_DIR"
  sudo mkdir -p "$TARGET_DIR"
fi

if [ ! -d "$TARGET_SUBDIR" ]; then
  echo "Creating $TARGET_SUBDIR"
  sudo mkdir -p "$TARGET_SUBDIR"
fi

echo "Adding $SOURCE_DIR to /etc/fstab"
sudo bash -c "echo '$SOURCE_DIR  $TARGET_SUBDIR  none  bind  0  0' >> /etc/fstab"

echo "Refreshing mount points"
sudo mount -a

if sudo mount | grep -q "$TARGET_SUBDIR"; then
  echo "Successfully mounted $SOURCE_DIR to $TARGET_SUBDIR"
else
  echo "Failed to mount $SOURCE_DIR to $TARGET_SUBDIR"
fi
