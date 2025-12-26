#!/bin/bash
# Script to find large files in git history

echo "==================================="
echo "Checking large files in git history..."
echo "==================================="
echo ""

# Find all objects in git history with their sizes
echo "Top 50 largest files in git history:"
echo "-----------------------------------"
git rev-list --objects --all | \
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
  sed -n 's/^blob //p' | \
  sort --numeric-sort --key=2 --reverse | \
  head -50 | \
  awk '{
    size=$2;
    if (size > 1024*1024*1024) {
      printf "%.2f GB\t%s\n", size/1024/1024/1024, $3
    } else if (size > 1024*1024) {
      printf "%.2f MB\t%s\n", size/1024/1024, $3
    } else if (size > 1024) {
      printf "%.2f KB\t%s\n", size/1024, $3
    } else {
      printf "%d B\t%s\n", size, $3
    }
  }'

echo ""
echo "==================================="
echo "Current repository size:"
echo "==================================="
du -sh .git

echo ""
echo "==================================="
echo "Files larger than 5MB in git history:"
echo "==================================="
git rev-list --objects --all | \
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
  sed -n 's/^blob //p' | \
  awk '$2 > 5*1024*1024 {
    size=$2;
    printf "%.2f MB\t%s\n", size/1024/1024, $3
  }' | \
  sort --numeric-sort --reverse

echo ""
echo "==================================="
echo "Summary by file type (>1MB):"
echo "==================================="
git rev-list --objects --all | \
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
  sed -n 's/^blob //p' | \
  awk '$2 > 1024*1024 {
    # Extract file extension
    filename=$3;
    if (match(filename, /\.[^.\/]+$/)) {
      ext=substr(filename, RSTART+1);
    } else {
      ext="(no extension)";
    }
    sizes[ext] += $2;
    counts[ext]++;
  }
  END {
    for (ext in sizes) {
      printf "%.2f MB\t%d files\t.%s\n", sizes[ext]/1024/1024, counts[ext], ext
    }
  }' | \
  sort --numeric-sort --reverse

echo ""
echo "==================================="
echo "Done!"
echo "==================================="
