"""
下载 scrcpy-server.jar

这个脚本会自动下载scrcpy-server v3.3.3并放置到正确的位置
与 scrcpy_source 版本保持一致
"""

from pathlib import Path
import sys

from pycore.pyfoundations.third_party import requests

def download_scrcpy_server():
    """下载scrcpy-server.jar v3.3.3"""

    # 目标路径
    target_dir = Path(__file__).parent / "resources"
    target_file = target_dir / "scrcpy-server.jar"

    # 确保目录存在
    target_dir.mkdir(exist_ok=True)

    # scrcpy-server v3.3.3下载链接（与 scrcpy_source 版本一致）
    url = "https://github.com/Genymobile/scrcpy/releases/download/v3.3.3/scrcpy-server-v3.3.3"

    print("=" * 60)
    print("下载 scrcpy-server v3.3.3")
    print("=" * 60)
    print(f"下载地址: {url}")
    print(f"保存位置: {target_file}")
    print()

    try:
        # 检查文件是否已存在
        if target_file.exists():
            response = input("文件已存在，是否重新下载？(y/N): ")
            if response.lower() != 'y':
                print("取消下载")
                return

        print("正在下载... (文件大小约 72 KB)")

        # 下载文件
        response = requests.get(url, stream=True)
        response.raise_for_status()

        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0

        with open(target_file, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)

                    # 显示进度
                    if total_size > 0:
                        progress = (downloaded / total_size) * 100
                        print(f"\r下载进度: {progress:.1f}% ({downloaded}/{total_size} bytes)", end='')

        print()
        print()
        print("✅ 下载完成！")
        print(f"文件保存在: {target_file}")
        print(f"文件大小: {target_file.stat().st_size / 1024 / 1024:.2f} MB")
        print()
        print("下一步:")
        print("  运行测试脚本验证: python poly_apps/pyMatrix/test_video_stream.py")

    except requests.RequestException as e:
        print(f"\n❌ 下载失败: {e}")
        print()
        print("手动下载方法:")
        print(f"  1. 访问: {url}")
        print(f"  2. 下载文件并重命名为: scrcpy-server.jar")
        print(f"  3. 放置到: {target_file}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    download_scrcpy_server()
