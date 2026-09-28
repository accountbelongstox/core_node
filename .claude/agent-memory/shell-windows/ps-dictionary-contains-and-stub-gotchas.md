---
name: ps-dictionary-contains-and-stub-gotchas
description: PowerShell cannot call .Contains on a generic Dictionary (explicit interface); harness stubs with a $ErrorAction param get null Get-Command .Parameters
metadata:
  type: feedback
---

Use `.ContainsKey()` for key checks that must work on Hashtable, PS 7 `OrderedHashtable` (ConvertFrom-Json -AsHashtable) and `Dictionary[string,object]` (5.1 JavaScriptSerializer). `.Contains()` fails on the generic Dictionary with "Cannot find an overload" because it is an explicit IDictionary member.

**Why:** found on 2026-09-28 (orch-wf1b) only because the harness simulated the 5.1 serializer shape with a C# class compiled via Add-Type; PS 7 alone would have passed.

**How to apply:** when a code path runs only on Windows PowerShell 5.1, simulate its return types in the snap pwsh harness ([[pwsh-snap-wrapper-fails]]). Proxy stubs that shadow a cmdlet must use `[CmdletBinding()]` and must not declare `$ErrorAction` (it clashes with the common parameter, and `(Get-Command X).Parameters` then comes back null).
