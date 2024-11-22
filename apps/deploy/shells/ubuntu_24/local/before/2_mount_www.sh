
SOURCE_DIR="/mnt/d/programing"
TARGET_DIR="/www"

grep -q "$SOURCE_DIR" /etc/fstab
if [ $? -ne 0 ]; then
  echo "$SOURCE_DIR not found in /etc/fstab"
else
  echo "$SOURCE_DIR is already in /etc/fstab"
  exit 0
fi

mount | grep -q "$TARGET_DIR"
if [ $? -ne 0 ]; then
  echo "$TARGET_DIR is not currently mounted"
else
  echo "$TARGET_DIR is already mounted"
  exit 0
fi

echo "Adding $SOURCE_DIR to /etc/fstab"
echo "$SOURCE_DIR  $TARGET_DIR  none  bind  0  0" >> /etc/fstab

echo "Refreshing mount points"
mount -a

if mount | grep -q "$TARGET_DIR"; then
  echo "Successfully mounted $SOURCE_DIR to $TARGET_DIR"
else
  echo "Failed to mount $SOURCE_DIR to $TARGET_DIR"
fi