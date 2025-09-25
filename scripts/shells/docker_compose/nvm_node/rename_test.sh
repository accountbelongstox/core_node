#! /usr/bin/env bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

find_name(){
  find test -name "*[\\/:\*\?\"<>\|]*" -o -name "*."
}

check_name() {
  if [ "$(find_name | wc -l)" != "0" ]; then
    printf '%s\n\n' "The following filenames contain unwanted characters:"
    find_name
    printf '\n%s\n%s\n' "Please run ./rename_test.sh" "If the problem persist, please open an issue."
    exit 1
  else
    echo "Ok"
  fi
}

rename_test() {
  local filename
  local new_filename
  while read -r filename; do
    # Even though it looks < and > are replaced by the same < and >, the latters are not ASCII code
    # If you check with 'cat -v rename_test.sh' you would see 's/</M-KM-^B/g' and 's/>/M-KM-^C/g'
    # M-KM-^B -> U+02C2
    # M-KM-^C -> U+02C3
    new_filename=$(echo "$filename" | sed -r \
      -e "s/\"/'/g" \
      -e 's/</??/g' \
      -e 's/>/??/g' \
      -e 's/^(.*)\.$/\1/'
      )
    printf '%s\n%s\n\n' "$filename" "$new_filename"
    [ "$filename" != "$new_filename" ] && git mv "$filename" "$new_filename"
  done < <(find_name)

  if [ "$(find_name | wc -l)" != "0" ]; then
    echo "Still some files to treat:"
    find_name
  else
    echo "Done"
  fi
}

main() {
  if [ "$1" = "--check" ]; then
    check_name
  else
    rename_test
  fi
}

main "$@"
