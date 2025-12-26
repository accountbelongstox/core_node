# Prompt System Web Page Design

## Code Browser Enhancement

At the bottom of the Code Browser page, there is another area: **Global Queue**.

## Task Queue Feature

Each task queue, when clicked, pops up a dialog (draggable, multiple floating):
- **Left side**: Prompt text information (editable)
- **Right side**: A playlist, each audio is audio of one sentence of prompts
  - Can click to automatically play
  - Next, previous buttons
  - Each audio can be clicked individually to play
  - After playing, toggle pause

## Prompt Area Features

- **Editable**: Prompt area can be edited
- **Auto-save**: Automatically saves
- **Auto-submit**: Automatically submits to server (write some pseudo code)

## Implementation Notes

- All dialogs should be draggable
- Support multiple floating dialogs
- Audio playback controls for each sentence
- Real-time editing and saving of prompts
- Automatic server synchronization

