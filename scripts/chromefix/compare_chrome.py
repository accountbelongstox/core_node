"""Compare two Chrome installations to detect tampering/injection.

Two layers of checking are performed:

1. Binary check on chrome.exe itself: cryptographic hashes (MD5 + SHA-256) plus
   the Authenticode digital signature of the suspect copy. A Valid signature
   proves the binary was genuinely published by Google and not modified.

2. Full directory equality: walk both Application directories, compute the MD5
   of every file, and compare per-file MD5, the total file count and the total
   folder count on both sides. "Fully equal" means identical tree structure with
   every file byte-for-byte identical (matching MD5) and the same counts.

Usage:
    python compare_chrome.py [REFERENCE_EXE] [SUSPECT_EXE]

With no arguments it falls back to the two default install paths below. The
directories compared are the folders that contain each chrome.exe.
"""

import hashlib
import os
import subprocess
import sys

# --- Module-level configuration (declared at top) ---------------------------
DEFAULT_REFERENCE = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
DEFAULT_SUSPECT = r"D:\applications\Chrome\Chrome\Application\chrome.exe"
HASH_ALGORITHMS = ("md5", "sha256")
READ_CHUNK_SIZE = 1024 * 1024  # 1 MiB streaming read, safe for large binaries
POWERSHELL_TIMEOUT = 60  # seconds
SEPARATOR = "-" * 64
MAX_LISTED = 40  # cap per-category path listing in the directory report


def compute_hashes(file_path):
    """Return a dict of {algorithm: hexdigest} for the given file."""
    hashers = {name: hashlib.new(name) for name in HASH_ALGORITHMS}
    with open(file_path, "rb") as handle:
        for chunk in iter(lambda: handle.read(READ_CHUNK_SIZE), b""):
            for hasher in hashers.values():
                hasher.update(chunk)
    return {name: hasher.hexdigest() for name, hasher in hashers.items()}


def compute_md5(file_path):
    """Return the MD5 hexdigest of a single file (streaming read)."""
    hasher = hashlib.md5()
    with open(file_path, "rb") as handle:
        for chunk in iter(lambda: handle.read(READ_CHUNK_SIZE), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def query_metadata(file_path):
    """Query file version and Authenticode signature via PowerShell.

    Returns a dict with keys: size, version, signature_status, signer.
    Falls back to "n/a" for fields that cannot be resolved.
    """
    metadata = {"size": "n/a", "version": "n/a", "signature_status": "n/a", "signer": "n/a"}
    try:
        metadata["size"] = str(os.path.getsize(file_path))
    except OSError:
        pass

    script = (
        "$ErrorActionPreference='Stop';"
        "$i=Get-Item -LiteralPath $env:TARGET_FILE;"
        "$s=Get-AuthenticodeSignature -LiteralPath $env:TARGET_FILE;"
        "Write-Output $i.VersionInfo.FileVersion;"
        "Write-Output $s.Status;"
        "Write-Output $s.SignerCertificate.Subject"
    )
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
            env={**os.environ, "TARGET_FILE": file_path},
            capture_output=True,
            text=True,
            timeout=POWERSHELL_TIMEOUT,
        )
        lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
        if len(lines) >= 1:
            metadata["version"] = lines[0]
        if len(lines) >= 2:
            metadata["signature_status"] = lines[1]
        if len(lines) >= 3:
            metadata["signer"] = lines[2]
    except (OSError, subprocess.SubprocessError):
        # PowerShell unavailable (non-Windows or restricted) -> hash check still valid.
        pass
    return metadata


def scan_tree(root):
    """Walk a directory tree and collect per-file MD5s and structure.

    Returns a dict with:
        files  : {normalized_relpath: {"display": relpath, "md5": hex_or_None}}
        dirs   : set of normalized relative directory paths
        errors : {relpath: error_message} for files that could not be read

    Case and separator differences are normalized (os.path.normcase) so the
    comparison is reliable on Windows' case-insensitive file system.
    """
    files = {}
    dirs = set()
    errors = {}
    for dirpath, dirnames, filenames in os.walk(root):
        for dirname in dirnames:
            rel_dir = os.path.relpath(os.path.join(dirpath, dirname), root)
            dirs.add(os.path.normcase(rel_dir))
        for filename in filenames:
            abs_file = os.path.join(dirpath, filename)
            rel_file = os.path.relpath(abs_file, root)
            key = os.path.normcase(rel_file)
            try:
                files[key] = {"display": rel_file, "md5": compute_md5(abs_file)}
            except OSError as exc:
                files[key] = {"display": rel_file, "md5": None}
                errors[rel_file] = str(exc)
    return {"files": files, "dirs": dirs, "errors": errors}


def compare_trees(reference_tree, suspect_tree):
    """Compare two scanned trees and return a structured diff."""
    ref_files = reference_tree["files"]
    sus_files = suspect_tree["files"]
    ref_keys = set(ref_files)
    sus_keys = set(sus_files)

    only_in_reference = sorted(ref_files[k]["display"] for k in ref_keys - sus_keys)
    only_in_suspect = sorted(sus_files[k]["display"] for k in sus_keys - ref_keys)

    differing = sorted(
        ref_files[k]["display"]
        for k in ref_keys & sus_keys
        if ref_files[k]["md5"] != sus_files[k]["md5"]
    )

    md5_all_equal = not (only_in_reference or only_in_suspect or differing)
    equal = (
        md5_all_equal
        and reference_tree["dirs"] == suspect_tree["dirs"]
        and not reference_tree["errors"]
        and not suspect_tree["errors"]
    )
    return {
        "only_in_reference": only_in_reference,
        "only_in_suspect": only_in_suspect,
        "differing": differing,
        "md5_all_equal": md5_all_equal,
        "equal": equal,
    }


def print_path_list(title, paths):
    """Print a capped list of relative paths under a title."""
    if not paths:
        return
    print(f"  {title} ({len(paths)}):")
    for path in paths[:MAX_LISTED]:
        print(f"      {path}")
    if len(paths) > MAX_LISTED:
        print(f"      ... and {len(paths) - MAX_LISTED} more")


def describe(label, file_path, hashes, metadata):
    """Print a labelled report block for a single file."""
    print(SEPARATOR)
    print(f"{label}: {file_path}")
    print(f"  size      : {metadata['size']} bytes")
    print(f"  version   : {metadata['version']}")
    print(f"  md5       : {hashes['md5']}")
    print(f"  sha256    : {hashes['sha256']}")
    print(f"  signature : {metadata['signature_status']}")
    print(f"  signer    : {metadata['signer']}")


def main(argv):
    """Entry point. Returns a process exit code (0 = fully equal, non-zero = differs)."""
    reference_path = argv[1] if len(argv) > 1 else DEFAULT_REFERENCE
    suspect_path = argv[2] if len(argv) > 2 else DEFAULT_SUSPECT

    missing = [p for p in (reference_path, suspect_path) if not os.path.isfile(p)]
    if missing:
        for path in missing:
            print(f"ERROR: file not found: {path}")
        return 2

    # --- Layer 1: binary check on chrome.exe -------------------------------
    reference_hashes = compute_hashes(reference_path)
    suspect_hashes = compute_hashes(suspect_path)
    reference_meta = query_metadata(reference_path)
    suspect_meta = query_metadata(suspect_path)

    describe("REFERENCE", reference_path, reference_hashes, reference_meta)
    describe("SUSPECT  ", suspect_path, suspect_hashes, suspect_meta)

    hashes_match = reference_hashes == suspect_hashes
    suspect_signed_valid = suspect_meta["signature_status"].lower() == "valid"

    # --- Layer 2: full directory equality ----------------------------------
    reference_dir = os.path.dirname(os.path.abspath(reference_path))
    suspect_dir = os.path.dirname(os.path.abspath(suspect_path))

    print(SEPARATOR)
    print("DIRECTORY SCAN")
    print(f"  reference dir : {reference_dir}")
    print(f"  suspect dir   : {suspect_dir}")

    reference_tree = scan_tree(reference_dir)
    suspect_tree = scan_tree(suspect_dir)
    diff = compare_trees(reference_tree, suspect_tree)

    ref_file_count = len(reference_tree["files"])
    sus_file_count = len(suspect_tree["files"])
    ref_dir_count = len(reference_tree["dirs"])
    sus_dir_count = len(suspect_tree["dirs"])
    file_count_equal = ref_file_count == sus_file_count
    dir_count_equal = ref_dir_count == sus_dir_count

    print(f"  files         : reference={ref_file_count}  suspect={sus_file_count}  "
          f"{'EQUAL' if file_count_equal else 'DIFFERENT'}")
    print(f"  folders       : reference={ref_dir_count}  suspect={sus_dir_count}  "
          f"{'EQUAL' if dir_count_equal else 'DIFFERENT'}")

    print_path_list("files only in reference", diff["only_in_reference"])
    print_path_list("files only in suspect", diff["only_in_suspect"])
    print_path_list("files with different MD5", diff["differing"])
    print_path_list("unreadable in reference", sorted(reference_tree["errors"]))
    print_path_list("unreadable in suspect", sorted(suspect_tree["errors"]))

    # --- Combined verdict ---------------------------------------------------
    print(SEPARATOR)
    print("VERDICT")
    print(f"  exe hash match    : {'YES' if hashes_match else 'NO'}")
    print(f"  suspect signature : {suspect_meta['signature_status']}")
    print(f"  file count equal  : {'YES' if file_count_equal else 'NO'}")
    print(f"  folder count equal: {'YES' if dir_count_equal else 'NO'}")
    print(f"  every file md5 eq : {'YES' if diff['md5_all_equal'] else 'NO'}")
    print(f"  fully equal       : {'YES' if diff['equal'] else 'NO'}")

    if diff["equal"]:
        if suspect_signed_valid or suspect_meta["signature_status"] == "n/a":
            print("  result            : CLEAN - directories are fully equal "
                  "(identical structure and every file MD5 matches).")
        else:
            print("  result            : EQUAL-BUT-CHECK - directories are fully equal, "
                  f"yet suspect signature is '{suspect_meta['signature_status']}'.")
        return 0

    print("  result            : NOT EQUAL - directories differ; see the lists above for "
          "files missing on one side or whose MD5 does not match.")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
