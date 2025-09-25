<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

## Configuration

Set the global config

```shell
git config --global user.name "[name]"
git config --global user.email "[email]"
```

## Get started

Create a git repository

```shell
git init
```

Clone an existing git repository

```shell
git clone [url]
```

## Commit

Commit all tracked changes

```shell
git commit -am "[commit message]"
```

Add new modifications to the last commit

```shell
git commit --amend --no-edit
```

## I’ve made a mistake

Change last commit message

```shell
git commit --amend
```

Undo most recent commit and keep changes

```shell
git reset HEAD~1
```

Undo the `N` most recent commit and keep changes

```shell
git reset HEAD~N
```

Undo most recent commit and get rid of changes

```shell
git reset HEAD~1 --hard
```

Reset branch to remote state

```shell
git fetch origin
git reset --hard origin/[branch-name]
```

## Miscellaneous

Renaming the local master branch to main

```shell
git branch -m master main
```
