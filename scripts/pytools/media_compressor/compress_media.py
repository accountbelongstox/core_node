"""
Baidu Netdisk Media File Compression Tool
Features: Scan, compress images/videos/audios, support resume and safe replacement

Main entry point and menu interface
"""

import shutil
from pathlib import Path

# Import file transfer modules
from file_transfer_server import FileTransferServer
from file_transfer_client import FileTransferClient

# Import media compressor modules
from media_compressor_core import MediaCompressor as MediaCompressorCore
from media_compressor_batch import MediaCompressorBatch


class MediaCompressor(MediaCompressorCore, MediaCompressorBatch):
    """
    Combined MediaCompressor class
    Inherits from both core and batch processing modules
    """
    pass


def show_menu():
    """Show main menu"""
    print(f"\n{'='*60}")
    print(f"  Baidu Netdisk Media Compression Tool")
    print(f"{'='*60}")
    print("1. Scan and Compress Files")
    print("   - Auto-select: GPU batch mode or CPU fallback")
    print("   - Smart multi-threaded processing")
    print("   - Unified skip logic (compressed/failed/duplicate)")
    print()
    print("2. Replace Original Files")
    print("   - Replace originals with compressed")
    print("   - WARNING: Will overwrite originals!")
    print()
    print("3. Show Statistics")
    print()
    print("4. Retry Failed Files")
    print("   - Clear failed status and retry")
    print()
    print("5. Start File Transfer Server")
    print("   - Scan SOURCE_DIR and start HTTP server")
    print("   - Allow remote download of all files")
    print("   - Supports resume download")
    print()
    print("6. Start File Transfer Client")
    print("   - Download all files from server")
    print("   - Input server IP:PORT to connect")
    print("   - Supports resume and skip downloaded")
    print()
    print("0. Exit")
    print(f"{'='*60}")


def main():
    """Main program"""
    compressor = MediaCompressor()

    while True:
        show_menu()
        choice = input("\nSelect operation (0-6): ").strip()

        if choice == '1':
            print("\n" + "="*60)
            print("Executing: Scan and Compress (Auto Mode)")
            print("="*60)

            # Auto-select batch or one-by-one mode
            # Batch mode if GPU available, otherwise fallback to one-by-one
            compressor.scan_and_compress_batch()

            print("\nProcess completed! Please verify compression results before replacing originals")

        elif choice == '2':
            compressor.replace_original_files()

        elif choice == '3':
            compressor.show_stats()

        elif choice == '4':
            compressor.retry_failed_files()

        elif choice == '5':
            # Start file transfer server
            print("\n" + "="*60)
            print("Starting File Transfer Server")
            print("="*60)

            # Ask for port
            port_input = input("Enter port (default 8000): ").strip()
            port = int(port_input) if port_input.isdigit() else 8000

            server = FileTransferServer(
                source_dir=compressor.SOURCE_DIR,
                host='0.0.0.0',
                port=port
            )
            server.start_server()

        elif choice == '6':
            # Start file transfer client
            print("\n" + "="*60)
            print("Starting File Transfer Client")
            print("="*60)

            # Ask for server address
            server_input = input("Enter server address (IP:PORT, e.g., 192.168.1.100:8000): ").strip()

            if not server_input:
                print("Server address is required!")
                continue

            # Parse server address
            if ':' in server_input:
                server_url = f"http://{server_input}"
            else:
                server_url = f"http://{server_input}:8000"

            # Ask for target directory
            target_input = input(f"Enter target directory (default: {compressor.SOURCE_DIR}): ").strip()
            target_dir = Path(target_input) if target_input else compressor.SOURCE_DIR

            try:
                client = FileTransferClient(
                    server_url=server_url,
                    target_dir=target_dir
                )
                client.download_all()
            except Exception as e:
                print(f"\nClient error: {e}")

        elif choice == '0':
            print("\nGoodbye!")
            break

        else:
            print("Invalid choice, please try again")

        input("\nPress Enter to continue...")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nProgram interrupted by user")
    except Exception as e:
        print(f"\nProgram error: {e}")
        import traceback
        traceback.print_exc()
