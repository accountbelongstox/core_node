# Linksys MX4200 V1 双分区 OpenWrt 恢复记录

适用设备：机身确认为 **MX4200 V1**，且临时系统运行 `cat /tmp/sysinfo/board_name` 输出 `linksys,mx4200v1`。本文记录本次实机验证成功的流程：从 ITB 临时启动，依次将 OpenWrt 25.12.4 写入两组固件槽，修复 U-Boot 双槽启动命令，并确认两个槽都能自动启动。

> 命令前的 `IPQ807x#` 和 `root@OpenWrt:~#` 都是提示符，复制命令时不要输入提示符。不要将 V2 或 MX4300 的镜像写入 V1。以下下载文件均为固定版本，避免 snapshot 文件名或内容变动。

## 1 镜像下载地址

| 用途 | 文件与下载地址 | SHA-256 |
| --- | --- | --- |
| U-Boot 从内存临时启动 | [MX4200 V1 initramfs ITB](https://downloads.openwrt.org/releases/25.12.4/targets/qualcommax/ipq807x/openwrt-25.12.4-qualcommax-ipq807x-linksys_mx4200v1-initramfs-uImage.itb) | `c5174f0c7fe33883f52fc9c402df403af41f91e93c619168fa1667e8090699cc` |
| 写入两组固件槽 | [MX4200 V1 sysupgrade BIN](https://downloads.openwrt.org/releases/25.12.4/targets/qualcommax/ipq807x/openwrt-25.12.4-qualcommax-ipq807x-linksys_mx4200v1-squashfs-sysupgrade.bin) | `df42fde7919ae4c37fee9bfeeb64af5d8c5d20864d90afa4d718c5bd05941bb2` |

ITB 只负责将临时 OpenWrt 启动到内存；永久安装使用 `squashfs-sysupgrade.bin`。此前提供的 snapshot ITB 直链返回过 404，本记录统一采用上述固定版本。

## 2 分区与设备核对

在临时 OpenWrt 中运行：

```sh
cat /tmp/sysinfo/board_name; cat /proc/mtd; cat /proc/cmdline; fw_printenv boot_part; ubinfo -a
```

本次实机分区：槽 1 是 `kernel`（mtd21，150 MiB）和 `rootfs`（mtd22，144 MiB）；槽 2 是 `alt_kernel`（mtd23，150 MiB）和 `alt_rootfs`（mtd24，144 MiB）。`syscfg` 是 mtd27，不能因为其中存在 UBI `kernel` 卷就把它当作本流程的目标分区。无需重新创建 MTD 分区或手工创建 UBI 卷。

## 3 从 U-Boot 临时启动 ITB

将上面的 **V1 ITB** 放入电脑的 TFTP 服务目录，重命名为 `a.itb`。本次路由器 IP 为 `192.168.1.1`；电脑 TFTP 服务器的实际 IP 应按现场设置。中断开机进入 `IPQ807x#` 后，以电脑 IP 为 `192.168.1.254` 为例：

```text
setenv ipaddr 192.168.1.1
setenv serverip 192.168.1.254
ping 192.168.1.254
tftpboot 0x44000000 a.itb
bootm 0x44000000#config@1
```

`bootm` 只能在 `tftpboot` 明确下载成功后执行。TFTP 停在 `Loading: *` 时检查服务端 IP、文件名、TFTP 服务和防火墙。本次 `setenv` 不需要 `saveenv`。若 FIT 的默认配置就是 `config@1`，`bootm 0x44000000` 也可启动；本次使用显式配置名。

临时系统里 `cat /proc/mounts` 显示 `/` 为 `tmpfs`，重启后 `/tmp` 文件会消失。

## 4 下载并校验永久镜像

本次电脑在 `192.168.1.254:16888` 提供了官方 sysupgrade 文件的本地副本，URL 为 `http://192.168.1.254:16888/mx4200v1.bin`。先确认这个文件确实是上面表中的 **V1 sysupgrade BIN**，再在路由器执行：

```sh
wget -O /tmp/mx4200v1-sysupgrade.bin http://192.168.1.254:16888/mx4200v1.bin && echo 'df42fde7919ae4c37fee9bfeeb64af5d8c5d20864d90afa4d718c5bd05941bb2  /tmp/mx4200v1-sysupgrade.bin' | sha256sum -c - && sysupgrade -T /tmp/mx4200v1-sysupgrade.bin
```

看到 `/tmp/mx4200v1-sysupgrade.bin: OK`，且 `sysupgrade -T` 正常返回命令提示符，才执行刷写。需要路由器直连外网时，也可从上表的官方 HTTPS 地址通过 `wget -O /tmp/mx4200v1-sysupgrade.bin URL` 获取，仍需做相同的 SHA-256 校验和测试。

## 5 第一次写入槽 2

本次临时系统中的 `boot_part=1`。校验通过后执行：

```sh
sysupgrade -n /tmp/mx4200v1-sysupgrade.bin
```

此次日志实际显示写入 `alt_kernel`，处理 `alt_rootfs`（mtd24），并输出 `sysupgrade successful`；U-Boot 的 `boot_part` 随后为 `2`。其中 `-n` 表示不保留旧配置。不要使用 `-F` 强行跳过镜像检查。

### 本次遇到的自动启动问题与修复

第一次刷完后，设备未自动进入槽 2，U-Boot 报 `Read 0 bytes from volume kernel`、`Config not availabale`。原因是当时 `bootcmd=bootipq`，它没有按 `boot_part` 调用已有的 `bootpart2`。在串口的 `IPQ807x#` 下执行以下**只读启动**命令，成功从 `alt_kernel` 和 `alt_rootfs` 进入了 OpenWrt：

```text
run bootpart2
```

进入槽 2 的 OpenWrt 后，检查环境并修复持久启动命令：

```sh
fw_printenv bootcmd boot_part auto_recovery
fw_setenv bootcmd 'if test $auto_recovery = no; then bootipq; elif test $boot_part = 1; then run bootpart1; else run bootpart2; fi'
fw_printenv bootcmd
reboot
```

保留单引号，让 `$boot_part` 由 U-Boot 在启动时求值。修复后本次实机的槽 2 已能够**无需手动干预自动启动**。若原本的 `bootcmd` 已包含正确的双槽条件判断，则无需重复修改。

## 6 第二次写入槽 1

必须先确认槽 2 已自动启动。执行：

```sh
cat /tmp/sysinfo/board_name; fw_printenv boot_part boot_part_ready auto_recovery maxpartialboots bootcmd; cat /proc/cmdline
```

本次确认 `linksys,mx4200v1`、`boot_part=2`、`boot_part_ready=3`、`auto_recovery=yes`，内核参数 `ubi.mtd=24,2048` 指向槽 2 的 `alt_rootfs`。

由于重启清空 `/tmp`，**再次运行第 4 节的下载、SHA-256 校验和 `sysupgrade -T`**。全部通过后执行：

```sh
sysupgrade -n /tmp/mx4200v1-sysupgrade.bin
```

从槽 2 升级会写入另一侧的槽 1，即 `kernel/rootfs`。重启后核对：

```sh
cat /tmp/sysinfo/board_name; fw_printenv boot_part boot_part_ready auto_recovery maxpartialboots bootcmd; cat /proc/cmdline
```

本次最终实机结果：`linksys,mx4200v1`、`boot_part=1`、`boot_part_ready=3`、`auto_recovery=yes`、`maxpartialboots=3`；`bootcmd` 含 `bootpart1/bootpart2` 条件判断，内核参数 `ubi.mtd=22,2048` 指向槽 1 的 `rootfs`。两个槽都已通过实际自动启动验证。

## 7 默认槽与自动回退

当前 `boot_part=1` 即默认从槽 1 启动，`auto_recovery=yes` 与 `maxpartialboots=3` 为固件失败后的自动切换提供条件。OpenWrt 的 MX4200 启动脚本会在成功启动后重置 `s_env` 中的启动计数。本次**没有故意制造失败来实测自动回退**。如果以后自动回退到槽 2，应先修复槽 1，再选择切回。

核查持久设置：

```sh
fw_printenv boot_part auto_recovery boot_part_ready maxpartialboots bootcmd
```

直接在 Linux shell 输入 `boot_part=1` 或 `auto_recovery=yes` 仅设置临时 shell 变量，**不会**修改 U-Boot 环境。当前实机这些持久设置已经正确，无需重设。

## 8 不使用的错误命令

- 不按分区号大小猜测目标，不对 mtd6 或其他未知分区运行 `ubiformat`。
- 不手动运行 `ubimkvol` 创建 40 MiB `kernel`、80 MiB `rootfs`；这些数值与本机分区及官方升级流程无关。
- 不假设写入 `kernel` 分区的数据会自动溢出到 `rootfs`。
- 不用 U-Boot 的 `run flashimg` 写 `sysupgrade.bin`。它是不同的 TFTP 裸写流程；本次安装使用 `sysupgrade`。
- 不把 ITB 当作永久安装镜像，也不使用 MX4300 或 MX4200 V2 的镜像。

## 参考资料

- [OpenWrt 25.12.4 ipq807x 官方镜像目录及 SHA-256](https://downloads.openwrt.org/releases/25.12.4/targets/qualcommax/ipq807x/)
- [OpenWrt MX4200 设备页面](https://openwrt.org/toh/linksys/mx4200_v1_and_v2)
- [OpenWrt MX4200 双槽升级实现](https://github.com/openwrt/openwrt/blob/main/target/linux/qualcommax/ipq807x/base-files/lib/upgrade/platform.sh)
- [OpenWrt 关于 Linksys 启动计数的讨论](https://github.com/openwrt/openwrt/issues/24857)
